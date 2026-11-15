// PROTOTYPE — results panel (spec section 3) + row rendering.
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, BorderType, Paragraph};

use crate::layout_metrics::{Cols, Mode};
use crate::row_status::row_status;
use crate::state::{Focus, State};
use crate::ui::{dim, pad_left, pad_right, s, CURSOR_BG};

pub fn render(f: &mut ratatui::Frame, state: &mut State, rect: Rect, cols: &Cols, _mode: Mode) {
    let search_focus = state.focus == Focus::Search;
    let focused = state.focus == Focus::List && !search_focus;
    let border_style = if focused { Style::new() } else { Style::new().fg(Color::DarkGray) };
    let count = state.entries.len();
    let block = Block::bordered()
        .border_type(BorderType::Rounded)
        .border_style(border_style)
        .title("─ Results ")
        .title_top(Line::from(format!(" {}/{} ", state.cursor + 1, count)).right_aligned());
    let inner = block.inner(rect);
    f.render_widget(block, rect);

    if state.loading_ticks > 0 {
        let frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
        let c = frames[(state.tick_n / 2) % frames.len()];
        let msg = Line::from(vec![
            s(format!("{c} "), Style::new().fg(Color::Cyan)),
            s("Getting results", dim()),
        ]);
        f.render_widget(Paragraph::new(msg).alignment(ratatui::layout::Alignment::Center), inner);
        return;
    }

    let vis = inner.height.saturating_sub(1) as usize; // header row eats one
    adjust_window(state, vis, count);

    // Dim column-header row.
    let header = header_line(cols);
    let rows_area = Rect { x: inner.x, y: inner.y, width: inner.width, height: inner.height.saturating_sub(1) };
    f.render_widget(Paragraph::new(header).style(dim()), rows_area);

    let mut lines: Vec<Line> = Vec::new();
    let start = state.list_start;
    for i in start..count.min(start + vis) {
        let e = &state.entries[i];
        let is_cursor = i == state.cursor;
        let st = row_status(
            state.dl_of(e.id),
            state.selected.contains(&e.id),
            state.bulk_queue.iter().find(|b| b.entry_id == e.id).map(|b| b.state),
        );
        lines.push(row_line(e, i, state.page, is_cursor, &st, cols, search_focus));
    }
    if count == 0 {
        let msg = Line::from(s(format!("No results for \"{}\"", state.search_value), dim()));
        f.render_widget(
            Paragraph::new(msg).alignment(ratatui::layout::Alignment::Center),
            rows_area,
        );
        return;
    }
    f.render_widget(Paragraph::new(lines), rows_area);
}

/// Scroll window: keep the cursor at least 2 rows from the edges when
/// possible (spec section 6.2 results-panel.ts).
fn adjust_window(state: &mut State, vis: usize, count: usize) {
    if vis == 0 || count == 0 || vis >= count {
        state.list_start = 0;
        return;
    }
    let cursor = state.cursor;
    let max_start = count - vis;
    if cursor < state.list_start + 2 {
        state.list_start = cursor.saturating_sub(2);
    }
    if cursor + 3 > state.list_start + vis {
        state.list_start = (cursor + 3).saturating_sub(vis);
    }
    state.list_start = state.list_start.min(max_start);
}

fn header_line(cols: &Cols) -> Line<'static> {
    let mut t = String::new();
    t.push_str(&" ".repeat(cols.cursor as usize));
    t.push_str(&pad_left("#", 2));
    t.push(' ');
    t.push_str(&pad_right("ext", 4));
    t.push(' ');
    t.push_str(&pad_right("title", cols.title as usize));
    t.push(' ');
    if let Some(w) = cols.author {
        t.push_str(&pad_right("author", w as usize));
        t.push_str("  ");
    }
    t.push_str(&pad_left("size", 5));
    t.push(' ');
    t.push_str(&pad_left("st", 3));
    t.push(' ');
    Line::from(t)
}

fn row_line(
    e: &crate::state::Entry,
    idx: usize,
    page: usize,
    is_cursor: bool,
    st: &crate::row_status::RowStatus,
    cols: &Cols,
    search_focus: bool,
) -> Line<'static> {
    let bg = if is_cursor && !search_focus {
        Style::new().bg(CURSOR_BG)
    } else {
        Style::new()
    };
    let global = idx + 1 + (page - 1) * crate::state::PAGE_SIZE;
    let mut spans: Vec<Span> = Vec::new();

    let cursor_glyph = if is_cursor { " ❯ " } else { "   " };
    spans.push(s(cursor_glyph, bg));
    spans.push(s(pad_left(&global.to_string(), 3) + " ", bg.patch(dim())));
    spans.push(s(pad_right(&e.ext, 4) + " ", bg.patch(Style::new().fg(Color::Green).add_modifier(Modifier::BOLD))));
    let title_style = if is_cursor && !search_focus {
        Style::new().add_modifier(Modifier::BOLD)
    } else {
        Style::new()
    };
    spans.push(s(pad_right(&e.title, cols.title as usize) + " ", bg.patch(title_style)));
    if let Some(w) = cols.author {
        spans.push(s(pad_right(&e.author, w as usize) + "  ", bg.patch(dim())));
    }
    spans.push(s(pad_left(&format!("{} MB", e.size_mb), 5) + " ", bg.patch(dim())));
    let st_text = if search_focus { " ".to_string() } else { st.label.clone() };
    spans.push(s(pad_left(&st_text, 3) + " ", bg.patch(Style::new().fg(st.color))));
    Line::from(spans)
}
