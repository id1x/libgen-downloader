// PROTOTYPE — row status label, mirroring spec section 6.2 row-status.ts.
// Priority table from spec section 3; a download status beats bulk selection.
use ratatui::style::Color;

use crate::state::{BulkState, DlState};

pub struct RowStatus {
    pub label: String,
    pub color: Color,
}

pub fn row_status(dl: Option<DlState>, bulk_selected: bool, bulk_state: Option<BulkState>) -> RowStatus {
    // Direct download status wins over the bulk glyph.
    if let Some(s) = dl {
        return match s {
            DlState::Downloading { progress, .. } => RowStatus { label: format!("{progress}%"), color: Color::Cyan },
            DlState::Queued => RowStatus { label: "⋯".into(), color: Color::DarkGray },
            DlState::Done => RowStatus { label: "✓".into(), color: Color::Green },
            DlState::Failed => RowStatus { label: "✗".into(), color: Color::Red },
        };
    }
    if bulk_selected {
        // During a settled run a failed item stays selected; show its outcome.
        if let Some(BulkState::Failed) = bulk_state {
            return RowStatus { label: "✗".into(), color: Color::Red };
        }
        if let Some(BulkState::Done) = bulk_state {
            return RowStatus { label: "✓".into(), color: Color::Green };
        }
        return RowStatus { label: "●".into(), color: Color::Yellow };
    }
    RowStatus { label: " ".into(), color: Color::DarkGray }
}
