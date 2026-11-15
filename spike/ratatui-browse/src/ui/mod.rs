// PROTOTYPE — shared text helpers + top-level render orchestration.
pub mod detail;
pub mod footer;
pub mod header;
pub mod overlays;
pub mod queue;
pub mod results;

use ratatui::layout::{Constraint, Layout};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;

use crate::layout_metrics::{compute_main, mode_for, Cols, Mode};
use crate::state::{Focus, SidePanel, State};

pub const CURSOR_BG: Color = Color::Rgb(31, 49, 64);

pub fn dim() -> Style {
    Style::new().fg(Color::DarkGray)
}

pub fn s(t: impl Into<String>, st: Style) -> Span<'static> {
    Span::styled(t.into(), st)
}

/// Truncate to `w` chars with an ellipsis.
pub fn trunc(s: &str, w: usize) -> String {
    let chars: Vec<char> = s.chars().collect();
    if w == 0 {
        return String::new();
    }
    if chars.len() <= w {
        s.to_string()
    } else {
        let keep = w.saturating_sub(1);
        format!("{}…", chars[..keep].iter().collect::<String>())
    }
}

pub fn pad_right(s: &str, w: usize) -> String {
    let t = trunc(s, w);
    let n = t.chars().count();
    format!("{t}{}", " ".repeat(w.saturating_sub(n)))
}

pub fn pad_left(s: &str, w: usize) -> String {
    let t = trunc(s, w);
    let n = t.chars().count();
    format!("{}{t}", " ".repeat(w.saturating_sub(n)))
}

pub fn bar(ratio: f32, w: usize) -> String {
    let w = w.max(1);
    let fill = (ratio.clamp(0.0, 1.0) * w as f32).round() as usize;
    format!("{}{}", "█".repeat(fill.min(w)), "░".repeat(w - fill.min(w)))
}

pub fn center_rect(area: ratatui::layout::Rect, w: u16, h: u16) -> ratatui::layout::Rect {
    use ratatui::layout::Rect;
    let w = w.min(area.width);
    let h = h.min(area.height);
    Rect {
        x: area.x + (area.width - w) / 2,
        y: area.y + (area.height - h) / 2,
        width: w,
        height: h,
    }
}

/// Add the DIM modifier to every cell outside `keep` (Ink has no z-index;
/// ratatui can just post-process the buffer — a verdict point for #15).
pub fn dim_except(f: &mut ratatui::Frame, keep: ratatui::layout::Rect) {
    let area = f.area();
    for y in area.y..area.bottom() {
        for x in area.x..area.right() {
            let inside = x >= keep.x && x < keep.right() && y >= keep.y && y < keep.bottom();
            if !inside {
                if let Some(cell) = f.buffer_mut().cell_mut((x, y)) {
                    cell.modifier.insert(Modifier::DIM);
                }
            }
        }
    }
}

/// Footer-style `[key, description]` spans: bold cyan keys, gray text.
pub fn key_hint(key: &str, desc: &str) -> Vec<Span<'static>> {
    vec![
        s(key, Style::new().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
        s(" ", Style::new()),
        s(desc, dim()),
    ]
}

/// Join hint pairs with two spaces, truncating with `…` to `width`.
pub fn hints_line(pairs: &[(&str, &str)], width: usize) -> Line<'static> {
    let mut spans: Vec<Span> = Vec::new();
    let mut used = 0usize;
    for (i, (k, d)) in pairs.iter().enumerate() {
        let need = k.chars().count() + 1 + d.chars().count() + if i + 1 < pairs.len() { 2 } else { 0 };
        if used + need > width && !spans.is_empty() {
            spans.push(s("…", dim()));
            break;
        }
        if i > 0 {
            spans.push(s("  ", Style::new()));
        }
        spans.extend(key_hint(k, d));
        used += need;
    }
    Line::from(spans)
}

/// Top-level frame: header, search line, main area, warning, footer,
/// then overlays (spec section 3 regions).
pub fn render(f: &mut ratatui::Frame, state: &mut State) {
    let area = f.area();
    if area.width < 40 || area.height < 12 {
        overlays::too_small(f, state, area);
        return;
    }

    if state.focus == Focus::FullDetail {
        let [h, sl, main, footer] =
            Layout::vertical([Constraint::Length(1), Constraint::Length(1), Constraint::Min(3), Constraint::Length(1)])
                .areas(area);
        header::status_header(f, state, h);
        header::search_line(f, state, sl);
        detail::render_full(f, state, main);
        footer::render(f, state, footer);
        return;
    }

    let warn_rows = usize::from(state.warning.is_some());
    let mut cons: Vec<Constraint> = vec![Constraint::Length(1), Constraint::Length(1), Constraint::Min(3)];
    if warn_rows == 1 {
        cons.push(Constraint::Length(1));
    }
    cons.push(Constraint::Length(1));
    let rows = Layout::vertical(cons).split(area);
    let (h, sl, main) = (rows[0], rows[1], rows[2]);
    let warn_rect = if warn_rows == 1 { Some(rows[3]) } else { None };
    let footer_rect = rows[rows.len() - 1];

    header::status_header(f, state, h);
    header::search_line(f, state, sl);

    let mode = mode_for(area.width);
    let queue_panel = state.side_panel == SidePanel::Queue;
    let m = compute_main(main, mode, queue_panel);
    let cols = Cols::for_width(m.results.width.saturating_sub(2), mode);

    results::render(f, state, m.results, &cols, mode);

    if state.focus == Focus::Search {
        overlays::search_history_panel(f, state, m.side);
    } else if state.side_panel == SidePanel::Queue {
        queue::render(f, state, m.side);
    } else {
        match mode {
            Mode::Wide => detail::render_wide(f, state, m.side),
            _ => detail::render_stacked(f, state, m.side),
        }
    }

    if let (Some(r), Some(msg)) = (warn_rect, state.warning.clone()) {
        f.render_widget(
            Paragraph::new(Line::from(s(format!("[!] {msg}"), Style::new().fg(Color::Yellow)))),
            r,
        );
    }
    footer::render(f, state, footer_rect);

    match state.focus {
        Focus::Help => {
            let r = center_rect(area, 46, 24);
            dim_except(f, r);
            overlays::help(f, r);
        }
        Focus::Quit => {
            let r = center_rect(area, 50, 11);
            dim_except(f, r);
            overlays::quit(f, state, r);
        }
        _ => {}
    }
}
