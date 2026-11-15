// PROTOTYPE — Detail panel, wide + stacked + full-screen (spec sections 3, 5.7).
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Line;
use ratatui::widgets::{Block, BorderType, Paragraph, Wrap};

use crate::state::{DlState, SidePanel, State};
use crate::ui::{bar, dim, key_hint, pad_right, s, trunc};

/// Bordered side panel with the `Detail │ Queue N` tab title. Shared by
/// detail and queue rendering.
pub fn panel_block(state: &State, width_hint: bool) -> Block<'static> {
    let n = state.queue_unfinished();
    let active_detail = state.side_panel == SidePanel::Detail;
    let title = Line::from(vec![
        s("─ ", Style::new()),
        s(
            "Detail",
            if active_detail { Style::new().add_modifier(Modifier::BOLD) } else { dim() },
        ),
        s(" │ ", dim()),
        s(
            if n > 0 { format!("Queue {n}") } else { "Queue".to_string() },
            if active_detail { dim() } else { Style::new().add_modifier(Modifier::BOLD) },
        ),
        s(" ", Style::new()),
    ]);
    let mut b = Block::bordered()
        .border_type(BorderType::Rounded)
        .title_top(title)
        .padding(ratatui::widgets::Padding::horizontal(1));
    if width_hint {
        b = b.title_top(Line::from(" v ").right_aligned());
    }
    b
}

pub fn render_wide(f: &mut ratatui::Frame, state: &State, rect: Rect) {
    let block = panel_block(state, true);
    let inner = block.inner(rect);
    f.render_widget(block, rect);
    let [content, bottom] = Layout::vertical([Constraint::Min(0), Constraint::Length(1)]).areas(inner);

    let e = match state.entries.get(state.cursor) {
        Some(e) => e,
        None => return,
    };
    let mut lines: Vec<Line> = Vec::new();
    lines.push(Line::from(s(e.title.clone(), Style::new().add_modifier(Modifier::BOLD))));
    lines.push(Line::from(s(e.author.clone(), dim())));
    lines.push(Line::default());
    lines.push(kv("Publisher", &e.publisher));
    lines.push(kv("Year", &e.year.to_string()));
    lines.push(kv("Pages", &e.pages.to_string()));
    lines.push(kv("Language", &e.language));
    lines.push(kv("Format", &e.ext));
    lines.push(kv("Size", &format!("{} MB", e.size_mb)));
    lines.push(kv("MD5", &md5_short(&e.md5)));
    lines.push(Line::default());
    lines.extend(download_block(state, e.id, inner.width as usize));
    lines.push(bulk_line(state, e.id));
    f.render_widget(Paragraph::new(lines).wrap(Wrap { trim: false }), content);

    let hint = hints(&[
        ("space", "bulk"),
        ("d", "download"),
        ("enter", "full screen"),
    ]);
    f.render_widget(hint, bottom);
}

/// Stacked compressed variant: exactly 5 content lines (spec section 3).
pub fn render_stacked(f: &mut ratatui::Frame, state: &State, rect: Rect) {
    let block = panel_block(state, rect.width >= 40);
    let inner = block.inner(rect);
    f.render_widget(block, rect);

    let e = match state.entries.get(state.cursor) {
        Some(e) => e,
        None => return,
    };
    let w = inner.width as usize;
    let mut lines: Vec<Line> = Vec::new();
    lines.push(Line::from(vec![
        s(trunc(&e.title, w.saturating_sub(e.author.chars().count() + 2)), Style::new().add_modifier(Modifier::BOLD)),
        s(format!("  {}", e.author), dim()),
    ]));
    lines.push(Line::from(s(
        format!(
            "{} · {} · {} pp · {} · {} · {} MB",
            e.publisher, e.year, e.pages, e.language, e.ext, e.size_mb
        ),
        dim(),
    )));
    match state.dl_of(e.id) {
        Some(DlState::Downloading { progress, done_mb }) => {
            lines.push(Line::from(vec![
                s("↓ ", Style::new().fg(Color::Cyan)),
                s(bar(progress as f32 / 100.0, w.saturating_sub(8)), Style::new().fg(Color::Cyan)),
                s(format!(" {}%", progress), Style::new().fg(Color::Cyan)),
            ]));
            lines.push(Line::from(s(
                format!("  {:.1} / {} MB · 1.8 MB/s · ~5s left", done_mb, e.size_mb),
                dim(),
            )));
        }
        other => {
            lines.push(status_line(other));
            lines.push(Line::default());
        }
    }
    lines.push(bulk_line(state, e.id));
    // Pad/truncate to exactly 5 lines so the panel height never jumps.
    while lines.len() < 5 {
        lines.push(Line::default());
    }
    lines.truncate(5);
    f.render_widget(Paragraph::new(lines), inner);
}

/// Full-screen detail (spec 5.7): the wide content at full width, every
/// field on its own row, wrapped not truncated.
pub fn render_full(f: &mut ratatui::Frame, state: &State, rect: Rect) {
    let title = Line::from(vec![
        s("─ Detail ", Style::new()),
        s(format!(" {}/{} ", state.cursor + 1, state.entries.len()), dim()),
    ]);
    let block = Block::bordered()
        .border_type(BorderType::Rounded)
        .title_top(title)
        .padding(ratatui::widgets::Padding::horizontal(1));
    let inner = block.inner(rect);
    f.render_widget(block, rect);
    let [content, bottom] = Layout::vertical([Constraint::Min(0), Constraint::Length(1)]).areas(inner);

    let e = match state.entries.get(state.cursor) {
        Some(e) => e,
        None => return,
    };
    let mut lines: Vec<Line> = Vec::new();
    lines.push(Line::from(s(format!("Title   {}", e.title), Style::new().add_modifier(Modifier::BOLD))));
    lines.push(Line::from(s(format!("Authors {}", e.author), dim())));
    lines.push(kv("Publisher", &e.publisher));
    lines.push(kv("Year", &e.year.to_string()));
    lines.push(kv("Pages", &e.pages.to_string()));
    lines.push(kv("Language", &e.language));
    lines.push(kv("Format", &e.ext));
    lines.push(kv("Size", &format!("{} MB", e.size_mb)));
    lines.push(kv("MD5", &e.md5));
    lines.push(Line::default());
    lines.extend(download_block(state, e.id, inner.width as usize));
    lines.push(bulk_line(state, e.id));
    f.render_widget(Paragraph::new(lines).wrap(Wrap { trim: false }), content);

    let hint = hints(&[("space", "bulk"), ("d", "download")]);
    f.render_widget(hint, bottom);
}

fn kv(label: &str, value: &str) -> Line<'static> {
    Line::from(vec![s(pad_right(label, 10), dim()), s(value.to_string(), Style::new())])
}

fn md5_short(md5: &str) -> String {
    if md5.len() > 12 {
        format!("{}…{}", &md5[..8], &md5[md5.len() - 4..])
    } else {
        md5.to_string()
    }
}

fn download_block(state: &State, id: usize, width: usize) -> Vec<Line<'static>> {
    match state.dl_of(id) {
        Some(DlState::Downloading { progress, done_mb }) => {
            let total = state.entry(id).map(|e| e.size_mb).unwrap_or(0);
            let bar_w = width.saturating_sub(12).max(10);
            vec![
                Line::from(vec![
                    s("↓ ", Style::new().fg(Color::Cyan)),
                    s(bar(progress as f32 / 100.0, bar_w), Style::new().fg(Color::Cyan)),
                    s(format!(" {}%", progress), Style::new().fg(Color::Cyan)),
                ]),
                Line::from(s(
                    format!("  {:.1} / {} MB · 1.8 MB/s · ~5s left", done_mb, total),
                    dim(),
                )),
            ]
        }
        other => vec![status_line(other)],
    }
}

fn status_line(dl: Option<DlState>) -> Line<'static> {
    match dl {
        Some(DlState::Queued) => Line::from(s("⋯ In queue", dim())),
        Some(DlState::Done) => Line::from(s("✓ Downloaded", Style::new().fg(Color::Green))),
        Some(DlState::Failed) => Line::from(s("✗ Download failed", Style::new().fg(Color::Red))),
        _ => Line::default(),
    }
}

fn bulk_line(state: &State, id: usize) -> Line<'static> {
    if state.selected.contains(&id) {
        Line::from(vec![
            s("● In bulk queue", Style::new().fg(Color::Yellow)),
            s("  space to remove", dim()),
        ])
    } else {
        Line::from(s("○ Not in bulk queue  space to add", dim()))
    }
}

fn hints(pairs: &[(&str, &str)]) -> Line<'static> {
    let mut spans = Vec::new();
    for (i, (k, d)) in pairs.iter().enumerate() {
        if i > 0 {
            spans.push(s("  ", Style::new()));
        }
        spans.extend(key_hint(k, d));
    }
    Line::from(spans)
}
