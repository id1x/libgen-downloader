// PROTOTYPE — layout metrics, mirroring spec section 6.2 layout-metrics.ts.
use ratatui::layout::{Constraint, Layout, Rect};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Mode {
    Wide,
    Stacked,
    Compact,
}

/// Results-panel column widths from spec section 3.
#[derive(Clone, Copy)]
pub struct Cols {
    pub cursor: u16,
    pub num: u16,
    pub ext: u16,
    pub title: u16,
    pub author: Option<u16>,
    pub size: u16,
    pub st: u16,
}

impl Cols {
    pub fn for_width(inner: u16, mode: Mode) -> Cols {
        let fixed = 3 + 3 + 5 + 6 + 4; // cursor # ext size st (no separators)
        let author_w = match mode {
            Mode::Compact => None,
            _ => {
                let title_min = fixed + 20;
                if inner < title_min + 17 {
                    Some(14)
                } else {
                    Some(16)
                }
            }
        };
        let author_used = author_w.map(|w| w + 2).unwrap_or(0);
        let title = inner.saturating_sub(fixed + author_used + 8).max(8);
        Cols { cursor: 3, num: 3, ext: 5, title, author: author_w, size: 6, st: 4 }
    }
}

pub struct Metrics {
    pub mode: Mode,
    pub results: Rect,
    pub side: Rect,
}

/// Main-area arrangement. Wide >= 100 cols side by side (results 55%,
/// min 56); 60-99 stacked with a 7-row detail side panel (12 for queue);
/// < 60 compact (author column hidden). Spec section 3.
pub fn compute_main(main: Rect, mode: Mode, queue_panel: bool) -> Metrics {
    match mode {
        Mode::Wide => {
            let results_w = (main.width * 55 / 100).max(56);
            let [results, side] = Layout::horizontal([Constraint::Length(results_w), Constraint::Min(0)])
                .areas(main);
            Metrics { mode, results, side }
        }
        Mode::Stacked | Mode::Compact => {
            let side_h = if queue_panel { 12 } else { 7 }.min(main.height.saturating_sub(3)).max(3);
            let [results, side] =
                Layout::vertical([Constraint::Min(3), Constraint::Length(side_h)]).areas(main);
            Metrics { mode, results, side }
        }
    }
}

pub fn mode_for(width: u16) -> Mode {
    if width >= 100 {
        Mode::Wide
    } else if width >= 60 {
        Mode::Stacked
    } else {
        Mode::Compact
    }
}
