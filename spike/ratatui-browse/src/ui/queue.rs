// PROTOTYPE — Queue panel (spec sections 3, 5.3).
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Line;
use ratatui::widgets::Paragraph;

use crate::state::{BulkState, DlState, QueueRowKind, State};
use crate::ui::{bar, dim, hints_line, pad_left, pad_right, s, trunc, CURSOR_BG};

pub fn render(f: &mut ratatui::Frame, state: &State, rect: Rect) {
    let block = crate::ui::detail::panel_block(state, rect.width >= 40);
    let inner = block.inner(rect);
    f.render_widget(block, rect);
    let [content, bottom] = Layout::vertical([Constraint::Min(0), Constraint::Length(1)]).areas(inner);

    let w = inner.width as usize;
    let mut lines: Vec<Line> = Vec::new();
    let mut action_lines: Vec<usize> = Vec::new(); // queue_rows() index -> line index

    // Bulk download section.
    match state.run.as_ref() {
        Some(run) if run.active => {
            let total = state.bulk_queue.len();
            let mut head = vec![
                s("Bulk download ", Style::new().add_modifier(Modifier::BOLD)),
                s(format!(" {} of {} done", run.done, total), dim()),
            ];
            if run.failed > 0 {
                head.push(s(format!(" · ✗ {} failed", run.failed), Style::new().fg(Color::Red)));
            }
            lines.push(Line::from(head));
            let pct = run.done as f32 / total.max(1) as f32;
            lines.push(Line::from(vec![
                s(bar(pct, w.saturating_sub(6)), Style::new().fg(Color::Yellow)),
                s(format!(" {}%", (pct * 100.0) as u8), dim()),
            ]));
            lines.push(Line::default());
        }
        Some(run) => {
            let total = state.bulk_queue.len();
            let mut head = vec![
                s("Bulk download ", Style::new().add_modifier(Modifier::BOLD)),
                s(format!(" {} of {} done", run.done, total), dim()),
            ];
            if run.failed > 0 {
                head.push(s(format!(" · ✗ {} failed", run.failed), Style::new().fg(Color::Red)));
            }
            lines.push(Line::from(head));
            lines.push(Line::default());
        }
        None => {
            lines.push(Line::from(vec![
                s("Bulk download ", Style::new().add_modifier(Modifier::BOLD)),
                s(format!(" {} selected", state.selected.len()), dim()),
            ]));
            lines.push(Line::default());
        }
    }

    // Bulk rows (or pre-run selection list).
    for (qi, row) in state.queue_rows().iter().enumerate() {
        if let QueueRowKind::Bulk(id) = row.kind {
            action_lines.push(lines.len());
            push_bulk_row(f, state, id, qi, w, &mut lines);
        }
    }

    // Direct downloads section.
    if !state.dl.is_empty() {
        lines.push(Line::default());
        lines.push(Line::from(s("Direct downloads", Style::new().add_modifier(Modifier::BOLD))));
        for (_qi, row) in state.queue_rows().iter().enumerate() {
            if let QueueRowKind::Direct(id) = row.kind {
                action_lines.push(lines.len());
                push_direct_row(state, id, w, &mut lines);
            }
        }
    }

    // Saved to + lists.
    lines.push(Line::default());
    lines.push(Line::from(s(format!("Saved to {}", state.save_dir), dim())));
    lines.push(Line::from(s(format!("Lists: {}", state.md5_list), dim())));

    // Scroll window over the cursor.
    let vis = content.height as usize;
    if vis > 0 {
        let cursor_line = action_lines
            .get(state.queue_cursor.min(action_lines.len().saturating_sub(1)))
            .copied()
            .unwrap_or(0);
        let start = if lines.len() > vis {
            (cursor_line.saturating_sub(vis / 2)).min(lines.len() - vis)
        } else {
            0
        };
        let window: Vec<Line> = lines[start..lines.len().min(start + vis)].to_vec();
        f.render_widget(Paragraph::new(window), content);
    }

    let hint = if state.run_active() {
        hints_line(&[("x", "remove"), ("r", "retry failed"), ("esc", "back")], w.saturating_sub(1))
    } else {
        hints_line(&[("x", "remove"), ("r", "retry failed"), ("esc", "back")], w.saturating_sub(1))
    };
    f.render_widget(hint, bottom);
}

fn entry_title(state: &State, id: usize, w: usize) -> String {
    match state.entry(id) {
        Some(e) => trunc(&e.title, w),
        None => trunc("md5 …", w),
    }
}

fn push_bulk_row(
    _f: &mut ratatui::Frame,
    state: &State,
    id: usize,
    qi: usize,
    w: usize,
    lines: &mut Vec<Line<'static>>,
) {
    let is_cursor = qi == state.queue_cursor;
    let bg = if is_cursor { Style::new().bg(CURSOR_BG) } else { Style::new() };
    let title_w = w.saturating_sub(14);
    match state.run {
        Some(_) => {
            let item = state.bulk_queue.iter().find(|b| b.entry_id == id);
            match item.map(|b| b.state) {
                Some(BulkState::Downloading { progress }) => {
                    let e = state.entry(id);
                    let size = e.map(|e| format!("{} MB", e.size_mb)).unwrap_or_default();
                    lines.push(Line::from(vec![
                        s("↓ ", bg.patch(Style::new().fg(Color::Cyan))),
                        s(pad_right(&entry_title(state, id, title_w), title_w) + " ", bg),
                        s(pad_left(&size, 6), bg.patch(dim())),
                    ]));
                    lines.push(Line::from(s(
                        format!("  {} {}% 2.1 MB/s", bar(progress as f32 / 100.0, w.saturating_sub(16)), progress),
                        Style::new().fg(Color::Cyan),
                    )));
                }
                Some(BulkState::Failed) => {
                    lines.push(Line::from(vec![
                        s("✗ ", bg.patch(Style::new().fg(Color::Red))),
                        s(pad_right(&entry_title(state, id, title_w), title_w) + " ", bg),
                        s(" retry r", bg.patch(dim())),
                    ]));
                    if let Some(reason) = state
                        .bulk_queue
                        .iter()
                        .find(|b| b.entry_id == id)
                        .and_then(|b| b.reason.clone())
                    {
                        lines.push(Line::from(s(format!("  {reason}"), Style::new().fg(Color::Red))));
                    }
                }
                Some(BulkState::Done) => {
                    let e = state.entry(id);
                    let size = e.map(|e| format!("{} MB", e.size_mb)).unwrap_or_default();
                    lines.push(Line::from(vec![
                        s("✓ ", bg.patch(Style::new().fg(Color::Green))),
                        s(pad_right(&entry_title(state, id, title_w), title_w) + " ", bg),
                        s(pad_left(&size, 6), bg.patch(dim())),
                    ]));
                }
                _ => {
                    let e = state.entry(id);
                    let size = e.map(|e| format!("{} MB", e.size_mb)).unwrap_or_default();
                    lines.push(Line::from(vec![
                        s("⋯ ", bg.patch(dim())),
                        s(pad_right(&entry_title(state, id, title_w), title_w) + " ", bg.patch(dim())),
                        s(pad_left(&size, 6), bg.patch(dim())),
                    ]));
                }
            }
        }
        None => {
            let e = state.entry(id);
            let size = e.map(|e| format!("{} MB", e.size_mb)).unwrap_or_default();
            lines.push(Line::from(vec![
                s("● ", bg.patch(Style::new().fg(Color::Yellow))),
                s(pad_right(&entry_title(state, id, title_w), title_w) + " ", bg),
                s(pad_left(&size, 6), bg.patch(dim())),
            ]));
        }
    }
}

fn push_direct_row(state: &State, id: usize, w: usize, lines: &mut Vec<Line<'static>>) {
    let title_w = w.saturating_sub(10);
    let e = state.entry(id);
    let size = e.map(|e| format!("{} MB", e.size_mb)).unwrap_or_default();
    let (sym, color) = match state.dl_of(id) {
        Some(DlState::Downloading { .. }) => ("↓", Color::Cyan),
        Some(DlState::Done) => ("✓", Color::Green),
        Some(DlState::Failed) => ("✗", Color::Red),
        _ => ("⋯", Color::DarkGray),
    };
    lines.push(Line::from(vec![
        s(format!("{sym} "), Style::new().fg(color)),
        s(pad_right(&entry_title(state, id, title_w), title_w) + " ", Style::new()),
        s(pad_left(&size, 6), dim()),
    ]));
}
