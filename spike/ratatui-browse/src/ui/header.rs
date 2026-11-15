// PROTOTYPE — status header + search line (spec section 3, regions 1-2).
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::Paragraph;

use crate::state::State;
use crate::ui::{bar, dim, s};

pub fn status_header(f: &mut ratatui::Frame, state: &State, rect: Rect) {
    let left_w = 52.min(rect.width / 2);
    let [left, right] = Layout::horizontal([Constraint::Length(left_w), Constraint::Min(0)]).areas(rect);
    let l = vec![
        s("libgen-downloader ", Style::new().add_modifier(Modifier::BOLD)),
        s("3.4.0", Style::new()),
        s("  │  ", dim()),
        s("● ", Style::new().fg(Color::Green)),
        s(state.mirror, Style::new()),
    ];
    f.render_widget(Paragraph::new(Line::from(l)), left);

    let right_line = if state.run_active() {
        let run = state.run.as_ref().unwrap();
        let total = state.bulk_queue.len();
        let mut spans = vec![
            s("bulk ", dim()),
            s(bar(run.done as f32 / total.max(1) as f32, 16), Style::new().fg(Color::Yellow)),
            s(format!(" {}/{}", run.done, total), dim()),
        ];
        if run.failed > 0 {
            spans.push(s(format!("  ·  ✗ {} failed", run.failed), Style::new().fg(Color::Red)));
        }
        spans.push(s("  ·  ↓ 2.1 MB/s", Style::new().fg(Color::Cyan)));
        Line::from(spans)
    } else {
        counts_summary(state, rect.width >= 100)
    };
    f.render_widget(Paragraph::new(right_line).alignment(ratatui::layout::Alignment::Right), right);
}

/// Omit zero counts (spec region 1). Compact form below 100 columns.
fn counts_summary(state: &State, wide: bool) -> Line<'static> {
    let (down, queued, in_bulk, done, failed) = state.header_counts();
    let mut parts: Vec<Span> = Vec::new();
    let push = |sym: &str, sym_color: Color, n: usize, label: &str, parts: &mut Vec<Span>| {
        if n == 0 {
            return;
        }
        if !parts.is_empty() {
            parts.push(s(" · ", dim()));
        }
        if wide {
            parts.push(s(sym, Style::new().fg(sym_color)));
            parts.push(s(format!(" {n} {label}"), dim()));
        } else {
            parts.push(s(sym, Style::new().fg(sym_color)));
            parts.push(s(n.to_string(), dim()));
        }
    };
    push("↓", Color::Cyan, down, "downloading", &mut parts);
    push("⋯", Color::DarkGray, queued, "queued", &mut parts);
    push("●", Color::Yellow, in_bulk, "in bulk", &mut parts);
    push("✓", Color::Green, done, "done", &mut parts);
    push("✗", Color::Red, failed, "failed", &mut parts);
    if parts.is_empty() {
        return Line::from(s("idle", dim()));
    }
    Line::from(parts)
}

pub fn search_line(f: &mut ratatui::Frame, state: &State, rect: Rect) {
    let [left, right] = Layout::horizontal([Constraint::Min(20), Constraint::Min(0)]).areas(rect);
    let left_line = if state.focus == crate::state::Focus::Search {
        Line::from(vec![
            s("/ ", dim()),
            s(state.search_draft.clone(), Style::new().add_modifier(Modifier::BOLD)),
            s("▏", Style::new().add_modifier(Modifier::BOLD)),
        ])
    } else {
        Line::from(vec![s("/ ", dim()), s(state.search_value.clone(), dim())])
    };
    f.render_widget(Paragraph::new(left_line), left);

    let right_line = if rect.width < 100 {
        Line::from(s(format!("p{}/{} · {}", state.page, state.pages_total, PAGE_RESULTS), dim()))
    } else {
        Line::from(s(
            format!("page {} of {}  ·  {} results", state.page, state.pages_total, PAGE_RESULTS),
            dim(),
        ))
    };
    f.render_widget(Paragraph::new(right_line).alignment(ratatui::layout::Alignment::Right), right);
}

const PAGE_RESULTS: usize = 25;
