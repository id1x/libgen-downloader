// PROTOTYPE — key-hint footer (spec section 4, footer hints by mode).
use ratatui::layout::Rect;
use ratatui::widgets::Paragraph;

use crate::state::Focus;
use crate::state::State;
use crate::ui::hints_line;

const LIST_WIDE: &[(&str, &str)] = &[
    ("↑↓", "move"),
    ("space", "bulk"),
    ("d", "download"),
    ("←→", "page"),
    ("/", "search"),
    ("b", "start bulk"),
    ("v", "queue"),
    ("?", "help"),
    ("q", "quit"),
];

const LIST_NARROW: &[(&str, &str)] = &[
    ("↑↓", "move"),
    ("space", "bulk"),
    ("d", "dl"),
    ("←→", "page"),
    ("/", "search"),
    ("b", "bulk dl"),
    ("?", "help"),
];

const QUEUE: &[(&str, &str)] = &[
    ("v", "detail"),
    ("↑↓", "move"),
    ("x", "remove"),
    ("r", "retry failed"),
    ("space", "bulk"),
    ("/", "search"),
    ("?", "help"),
    ("q", "quit"),
];

const SEARCH: &[(&str, &str)] = &[("enter", "search"), ("esc", "cancel"), ("↑↓", "history"), ("ctrl+u", "clear")];

const HELP: &[(&str, &str)] = &[("esc", "close help")];

const QUIT: &[(&str, &str)] = &[("y", "quit"), ("n / esc", "stay")];

const FULL_DETAIL: &[(&str, &str)] = &[("esc", "back"), ("↑↓", "prev/next"), ("space", "bulk"), ("d", "download")];

pub fn render(f: &mut ratatui::Frame, state: &State, rect: Rect) {
    let width = rect.width as usize;
    let pairs = match state.focus {
        Focus::List => {
            if width >= 100 {
                LIST_WIDE
            } else {
                LIST_NARROW
            }
        }
        Focus::Queue => QUEUE,
        Focus::Search => SEARCH,
        Focus::Help => HELP,
        Focus::Quit => QUIT,
        Focus::FullDetail => FULL_DETAIL,
    };
    f.render_widget(Paragraph::new(hints_line(pairs, width.saturating_sub(1))), rect);
}
