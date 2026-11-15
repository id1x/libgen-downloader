// PROTOTYPE — overlays: help, quit prompt, search-history panel, too-small.
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style};
use ratatui::text::Line;
use ratatui::widgets::{Block, BorderType, Clear, Paragraph};

use crate::state::State;
use crate::ui::{dim, hints_line, s};

pub fn help(f: &mut ratatui::Frame, rect: Rect) {
    let block = Block::bordered()
        .border_type(BorderType::Rounded)
        .title("─ Keys ")
        .padding(ratatui::widgets::Padding::horizontal(1));
    let inner = block.inner(rect);
    f.render_widget(Clear, rect);
    f.render_widget(block, rect);
    f.render_widget(Paragraph::new(help_lines()), inner);
}

fn help_lines() -> Vec<Line<'static>> {
    let mut lines: Vec<Line> = Vec::new();
    let section = |name: &str, lines: &mut Vec<Line>| lines.push(Line::from(name.to_string()));
    let row = |keys: &str, desc: &str, lines: &mut Vec<Line>| {
        lines.push(Line::from(vec![
            s(format!(" {:<10} ", keys), Style::new().fg(Color::Cyan).add_modifier(Modifier::BOLD)),
            s(desc.to_string(), dim()),
        ]));
    };
    section("Navigate", &mut lines);
    row("↑ ↓  k j", "move cursor", &mut lines);
    row("pgup pgdn", "jump 10", &mut lines);
    row("g G", "first / last", &mut lines);
    row("← →  h l", "prev / next page", &mut lines);
    lines.push(Line::default());
    section("Act on item", &mut lines);
    row("space", "add / remove from bulk", &mut lines);
    row("d", "download now", &mut lines);
    row("enter", "full-screen detail", &mut lines);
    row("tab", "same as space (legacy)", &mut lines);
    lines.push(Line::default());
    section("Global", &mut lines);
    row("/", "search", &mut lines);
    row("b", "start bulk download", &mut lines);
    row("v", "toggle queue panel", &mut lines);
    row("r", "retry failed downloads", &mut lines);
    row("ctrl+r", "re-check libgen now", &mut lines);
    row("?", "this help", &mut lines);
    row("q", "quit", &mut lines);
    lines.push(Line::default());
    lines.push(Line::from(s(" esc or ? to close", dim())));
    lines
}

pub fn quit(f: &mut ratatui::Frame, state: &State, rect: Rect) {
    let block = Block::bordered()
        .border_type(BorderType::Rounded)
        .title("─ Quit? ")
        .padding(ratatui::widgets::Padding::horizontal(1));
    let inner = block.inner(rect);
    f.render_widget(Clear, rect);
    f.render_widget(block, rect);

    let direct_pending: Vec<_> = state.dl.iter().filter(|(_, s)| !s.terminal()).collect();
    let run_active = state.run_active();
    let bulk_pending = !state.selected.is_empty() && !state.run_complete();

    let mut lines: Vec<Line> = Vec::new();
    lines.push(Line::default());
    if direct_pending.len() == 1 {
        lines.push(Line::from(" 1 download is still running"));
    } else if direct_pending.len() > 1 {
        lines.push(Line::from(format!(" {} downloads are still running", direct_pending.len())));
    }
    if bulk_pending {
        let n = state.selected.len();
        if n == 1 {
            lines.push(Line::from(" 1 item is in the bulk queue"));
        } else {
            lines.push(Line::from(format!(" {n} items are in the bulk queue")));
        }
    }
    if run_active {
        let r = state.run.as_ref().unwrap();
        lines.push(Line::from(format!(" Bulk download is {}/{} done", r.done, state.bulk_queue.len())));
    }
    lines.push(Line::default());
    lines.push(Line::from(" Quitting stops the download and"));
    lines.push(Line::from(" forgets the bulk selection."));
    lines.push(Line::default());
    lines.push(Line::from(vec![
        s(" y ", Style::new().fg(Color::Red).add_modifier(Modifier::REVERSED)),
        s(" quit anyway     ", Style::new()),
        s(" n ", Style::new().fg(Color::Cyan).add_modifier(Modifier::REVERSED)),
        s(" stay", Style::new()),
    ]));
    f.render_widget(Paragraph::new(lines), inner);
}

/// Search-history side panel (spec 5.4). In stacked mode it replaces the
/// Detail panel.
pub fn search_history_panel(f: &mut ratatui::Frame, state: &State, rect: Rect) {
    let block = Block::bordered()
        .border_type(BorderType::Rounded)
        .title("─ Search ")
        .padding(ratatui::widgets::Padding::horizontal(1));
    let inner = block.inner(rect);
    f.render_widget(block, rect);
    let [content, bottom] = Layout::vertical([Constraint::Min(0), Constraint::Length(1)]).areas(inner);

    let mut lines: Vec<Line> = Vec::new();
    lines.push(Line::from(s("Recent searches", dim())));
    lines.push(Line::default());
    lines.push(Line::from(vec![
        s(" ❯ ", Style::new().fg(Color::Cyan)),
        s(state.search_draft.clone(), Style::new()),
    ]));
    for h in &state.search_history {
        lines.push(Line::from(s(format!("   {h}"), dim())));
    }
    lines.push(Line::default());
    lines.push(Line::from(s(" ↑↓ pick · enter search · esc cancel", dim())));
    lines.push(Line::default());
    lines.push(Line::from(s("Selections are kept across searches:", dim())));
    lines.push(Line::from(vec![
        s(format!("● {} in bulk queue", state.selected.len()), Style::new().fg(Color::Yellow)),
    ]));
    f.render_widget(Paragraph::new(lines), content);
    f.render_widget(
        Paragraph::new(hints_line(&[("enter", "search"), ("esc", "cancel")], inner.width as usize)),
        bottom,
    );
}

/// Below the 40×12 floor (spec 8.4): size message only, `q` still works.
pub fn too_small(f: &mut ratatui::Frame, state: &State, area: Rect) {
    let _ = state;
    let msg = Paragraph::new(vec![
        Line::from("Terminal too small (min 40×12)"),
        Line::from(s(format!("(now {}×{})", area.width, area.height), dim())),
    ])
    .alignment(ratatui::layout::Alignment::Center);
    f.render_widget(msg, area);
    let footer = Rect { x: area.x, y: area.bottom().saturating_sub(1), width: area.width, height: 1 };
    f.render_widget(
        Paragraph::new(hints_line(&[("q", "quit")], area.width as usize)),
        footer,
    );
}
