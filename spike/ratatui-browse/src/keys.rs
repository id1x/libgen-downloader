// PROTOTYPE — the single key router, mirroring spec section 6.2
// use-browse-keys.ts: one dispatch on focus mode, no per-component handlers.
use ratatui::crossterm::event::{KeyCode, KeyEvent, KeyModifiers};

use crate::state::{Focus, SidePanel, State};

pub fn route(state: &mut State, key: KeyEvent) {
    if key.kind != ratatui::crossterm::event::KeyEventKind::Press {
        return;
    }
    // Priority rule 4: while loading, only q, ? and ctrl+c work.
    if state.loading_ticks > 0 {
        match (key.code, key.modifiers) {
            (KeyCode::Char('q'), m) if m == KeyModifiers::NONE => state.request_quit(),
            (KeyCode::Char('?'), _) => state.open_overlay(Focus::Help),
            _ => {}
        }
        return;
    }
    match state.focus {
        Focus::List => list_keys(state, key),
        Focus::Queue => queue_keys(state, key),
        Focus::Search => search_keys(state, key),
        Focus::Help => match key.code {
            KeyCode::Esc | KeyCode::Char('?') => state.close_overlay(),
            _ => {}
        },
        Focus::Quit => match key.code {
            KeyCode::Char('y') => state.should_exit = true,
            KeyCode::Char('n') | KeyCode::Esc | KeyCode::Enter => state.close_overlay(),
            _ => {}
        },
        Focus::FullDetail => full_detail_keys(state, key),
    }
}

fn list_keys(state: &mut State, key: KeyEvent) {
    match (key.code, key.modifiers) {
        (KeyCode::Up, _) | (KeyCode::Char('k'), _) => state.move_cursor(-1),
        (KeyCode::Down, _) | (KeyCode::Char('j'), _) => state.move_cursor(1),
        (KeyCode::PageUp, _) => state.move_cursor(-10),
        (KeyCode::PageDown, _) => state.move_cursor(10),
        (KeyCode::Char('g'), m) if m == KeyModifiers::NONE => state.cursor_edge(false),
        (KeyCode::Char('G'), _) => state.cursor_edge(true),
        (KeyCode::Left, _) | (KeyCode::Char('h'), _) => state.page_prev(),
        (KeyCode::Right, _) | (KeyCode::Char('l'), _) => state.page_next(),
        (KeyCode::Char(' '), _) | (KeyCode::Tab, _) => {
            if let Some(e) = state.entries.get(state.cursor) {
                let id = e.id;
                state.toggle_bulk(id);
            }
        }
        (KeyCode::Char('d'), m) if m == KeyModifiers::NONE => {
            if let Some(e) = state.entries.get(state.cursor) {
                let id = e.id;
                state.start_dl(id);
            }
        }
        (KeyCode::Enter, _) => state.focus = Focus::FullDetail,
        (KeyCode::Char('/'), _) => state.focus_search(),
        (KeyCode::Char('b'), _) => state.start_bulk(),
        (KeyCode::Char('v'), _) => {
            state.side_panel = SidePanel::Queue;
            state.focus = Focus::Queue;
        }
        (KeyCode::Char('r'), _) => state.retry_failed(),
        (KeyCode::Char('?'), _) => state.open_overlay(Focus::Help),
        (KeyCode::Char('q'), m) if m == KeyModifiers::NONE => state.request_quit(),
        _ => {}
    }
}

fn queue_keys(state: &mut State, key: KeyEvent) {
    match (key.code, key.modifiers) {
        (KeyCode::Up, _) | (KeyCode::Char('k'), _) => state.queue_move(-1),
        (KeyCode::Down, _) | (KeyCode::Char('j'), _) => state.queue_move(1),
        (KeyCode::Char('x'), _) => {
            if let Some(id) = state.queue_entry() {
                if matches!(state.queue_rows()[state.queue_cursor].kind, crate::state::QueueRowKind::Bulk(_)) {
                    state.remove_bulk(id);
                }
            }
        }
        (KeyCode::Char('r'), _) => state.retry_failed(),
        (KeyCode::Char('d'), m) if m == KeyModifiers::NONE => {
            if let Some(id) = state.queue_entry() {
                state.start_dl(id);
            }
        }
        (KeyCode::Char(' '), _) | (KeyCode::Tab, _) => {
            if let Some(id) = state.queue_entry() {
                state.toggle_bulk(id);
            }
        }
        (KeyCode::Esc, _) | (KeyCode::Char('v'), _) => {
            state.side_panel = SidePanel::Detail;
            state.focus = Focus::List;
        }
        (KeyCode::Char('/'), _) => state.focus_search(),
        (KeyCode::Char('?'), _) => state.open_overlay(Focus::Help),
        (KeyCode::Char('q'), m) if m == KeyModifiers::NONE => state.request_quit(),
        _ => {}
    }
}

fn search_keys(state: &mut State, key: KeyEvent) {
    match (key.code, key.modifiers) {
        (KeyCode::Esc, _) => {
            state.search_draft = state.search_value.clone();
            state.focus = Focus::List;
        }
        (KeyCode::Enter, _) => state.submit_search(),
        (KeyCode::Backspace, _) => {
            state.search_draft.pop();
        }
        (KeyCode::Up, _) => state.hist_up(),
        (KeyCode::Down, _) => state.hist_down(),
        (KeyCode::Char('u'), m) if m.contains(KeyModifiers::CONTROL) => state.search_draft.clear(),
        (KeyCode::Char(c), m) if !m.contains(KeyModifiers::CONTROL) => {
            state.search_draft.push(c);
            state.hist_idx = None;
        }
        _ => {}
    }
}

fn full_detail_keys(state: &mut State, key: KeyEvent) {
    match (key.code, key.modifiers) {
        (KeyCode::Esc, _) | (KeyCode::Enter, _) => state.focus = Focus::List,
        (KeyCode::Up, _) => state.move_cursor(-1),
        (KeyCode::Down, _) => state.move_cursor(1),
        (KeyCode::Char(' '), _) | (KeyCode::Tab, _) => {
            if let Some(e) = state.entries.get(state.cursor) {
                let id = e.id;
                state.toggle_bulk(id);
            }
        }
        (KeyCode::Char('d'), m) if m == KeyModifiers::NONE => {
            if let Some(e) = state.entries.get(state.cursor) {
                let id = e.id;
                state.start_dl(id);
            }
        }
        _ => {}
    }
}
