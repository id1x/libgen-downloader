// PROTOTYPE — mock "store" for the ratatui spike. Throwaway.
// Mirrors the spec's store slices loosely: app state + download queue +
// bulk queue + the new browse slice, flattened into one struct.
use std::collections::BTreeSet;

pub const PAGE_SIZE: usize = 25;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Focus {
    List,
    Queue,
    Search,
    Help,
    Quit,
    FullDetail,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum SidePanel {
    Detail,
    Queue,
}

#[derive(Clone, Copy, PartialEq)]
pub enum DlState {
    Queued,
    Downloading { progress: u8, done_mb: f32 },
    Done,
    Failed,
}

impl DlState {
    pub fn terminal(self) -> bool {
        matches!(self, DlState::Done | DlState::Failed)
    }
}

#[derive(Clone, Copy, PartialEq)]
pub enum BulkState {
    Pending,
    Downloading { progress: u8 },
    Done,
    Failed,
}

impl BulkState {
    pub fn terminal(self) -> bool {
        matches!(self, BulkState::Done | BulkState::Failed)
    }
}

pub struct BulkItem {
    pub entry_id: usize,
    pub state: BulkState,
    pub reason: Option<String>,
}

pub struct BulkRun {
    pub active: bool,
    pub done: usize,
    pub failed: usize,
}

#[derive(Clone)]
pub struct Entry {
    pub id: usize,
    pub title: String,
    pub author: String,
    pub ext: String,
    pub size_mb: u32,
    pub publisher: String,
    pub year: u32,
    pub pages: u32,
    pub language: String,
    pub md5: String,
}

#[derive(Clone, Copy)]
pub enum QueueRowKind {
    Bulk(usize),
    Direct(usize),
}

pub struct QueueRow {
    pub kind: QueueRowKind,
}

pub struct State {
    pub entries: Vec<Entry>,
    pub cursor: usize,
    pub list_start: usize,
    pub page: usize,
    pub pages_total: usize,
    pub next_ready: bool,
    pub focus: Focus,
    pub focus_before_overlay: Focus,
    pub side_panel: SidePanel,
    pub queue_cursor: usize,
    pub search_value: String,
    pub search_draft: String,
    pub search_history: Vec<String>,
    pub hist_idx: Option<usize>,
    pub warning: Option<String>,
    pub loading_ticks: usize,
    /// Direct downloads, newest last (rendered newest first).
    pub dl: Vec<(usize, DlState)>,
    /// Bulk selection, keyed by entry id (stand-in for objectHash(entry)).
    pub selected: BTreeSet<usize>,
    /// Bulk run display list; kept after the run until the next `b`.
    pub bulk_queue: Vec<BulkItem>,
    pub run: Option<BulkRun>,
    pub tick_n: usize,
    pub should_exit: bool,
    pub mirror: &'static str,
    pub save_dir: &'static str,
    pub md5_list: &'static str,
}

impl State {
    /// The section 5.1 scenario: cursor on item 2 (downloading 42%),
    /// item 1 done, 3/5/7 bulk-selected, 4 queued, 9 failed.
    pub fn seed() -> Self {
        State {
            entries: crate::mock::page_entries(1),
            cursor: 1,
            list_start: 0,
            page: 1,
            pages_total: 3,
            next_ready: true,
            focus: Focus::List,
            focus_before_overlay: Focus::List,
            side_panel: SidePanel::Detail,
            queue_cursor: 0,
            search_value: "python".into(),
            search_draft: "python".into(),
            search_history: vec!["distributed systems".into(), "type theory".into(), "compilers".into()],
            hist_idx: None,
            warning: None,
            loading_ticks: 0,
            dl: vec![
                (1, DlState::Done),
                (2, DlState::Downloading { progress: 42, done_mb: 5.9 }),
                (4, DlState::Queued),
                (9, DlState::Failed),
            ],
            selected: BTreeSet::from([3, 5, 7]),
            bulk_queue: Vec::new(),
            run: None,
            tick_n: 0,
            should_exit: false,
            mirror: "mirror-a.example",
            save_dir: "~/Downloads/libgen",
            md5_list: "md5_list_1794650.txt",
        }
    }

    pub fn entry(&self, id: usize) -> Option<&Entry> {
        self.entries.iter().find(|e| e.id == id)
    }

    pub fn dl_of(&self, id: usize) -> Option<DlState> {
        self.dl.iter().find(|(i, _)| *i == id).map(|(_, s)| *s)
    }

    fn set_dl(&mut self, id: usize, s: DlState) {
        if let Some(slot) = self.dl.iter_mut().find(|(i, _)| *i == id) {
            slot.1 = s;
        } else {
            self.dl.push((id, s));
        }
    }

    pub fn bulk_outcome_terminal(&self, id: usize) -> bool {
        self.bulk_queue
            .iter()
            .find(|b| b.entry_id == id)
            .map(|b| b.state.terminal())
            .unwrap_or(false)
    }

    /// Spec section 3: unfinished-item count = bulk-selected entries with no
    /// terminal run outcome + direct downloads not yet terminal.
    pub fn queue_unfinished(&self) -> usize {
        let bulk_pending = self.selected.iter().filter(|id| !self.bulk_outcome_terminal(**id)).count();
        let direct = self.dl.iter().filter(|(_, s)| !s.terminal()).count();
        bulk_pending + direct
    }

    /// (downloading, queued, in bulk, done, failed) for the header summary.
    pub fn header_counts(&self) -> (usize, usize, usize, usize, usize) {
        let downloading = self.dl.iter().filter(|(_, s)| matches!(s, DlState::Downloading { .. })).count();
        let queued = self.dl.iter().filter(|(_, s)| *s == DlState::Queued).count();
        let done = self.dl.iter().filter(|(_, s)| *s == DlState::Done).count();
        let failed = self.dl.iter().filter(|(_, s)| *s == DlState::Failed).count();
        (downloading, queued, self.selected.len(), done, failed)
    }

    pub fn run_active(&self) -> bool {
        self.run.as_ref().map(|r| r.active).unwrap_or(false)
    }

    pub fn run_complete(&self) -> bool {
        self.run.as_ref().map(|r| !r.active).unwrap_or(false)
    }

    pub fn warn(&mut self, msg: &str) {
        self.warning = Some(msg.to_string());
    }

    // ----- actions (key router calls these) -----

    pub fn move_cursor(&mut self, delta: isize) {
        if self.entries.is_empty() {
            self.cursor = 0;
            return;
        }
        let len = self.entries.len() as isize;
        self.cursor = (self.cursor as isize + delta).clamp(0, len - 1) as usize;
        self.warning = None;
    }

    pub fn cursor_edge(&mut self, last: bool) {
        self.cursor = if last { self.entries.len().saturating_sub(1) } else { 0 };
        self.warning = None;
    }

    pub fn page_next(&mut self) {
        if self.page >= self.pages_total {
            self.warn("No more results");
            return;
        }
        self.page += 1;
        self.cursor = 0;
        self.list_start = 0;
        self.entries = crate::mock::page_entries(self.page);
        self.loading_ticks = 6;
        self.warning = None;
    }

    pub fn page_prev(&mut self) {
        if self.page <= 1 {
            return;
        }
        self.page -= 1;
        self.cursor = 0;
        self.list_start = 0;
        self.entries = crate::mock::page_entries(self.page);
        self.loading_ticks = 6;
        self.warning = None;
    }

    pub fn toggle_bulk(&mut self, id: usize) {
        if !self.selected.remove(&id) {
            self.selected.insert(id);
        }
        self.warning = None;
    }

    /// `d` on an already-downloaded entry is allowed (spec 8.4): status
    /// goes back to the queue glyph.
    pub fn start_dl(&mut self, id: usize) {
        match self.dl_of(id) {
            Some(DlState::Queued) | Some(DlState::Downloading { .. }) => {}
            _ => {
                self.set_dl(id, DlState::Queued);
                self.warning = None;
            }
        }
    }

    pub fn start_bulk(&mut self) {
        if self.run_active() {
            self.warn("Bulk download already running");
            return;
        }
        if self.selected.is_empty() {
            self.warn("Nothing selected for bulk download");
            return;
        }
        self.bulk_queue = self
            .selected
            .iter()
            .map(|id| BulkItem { entry_id: *id, state: BulkState::Pending, reason: None })
            .collect();
        self.run = Some(BulkRun { active: true, done: 0, failed: 0 });
        self.side_panel = SidePanel::Queue;
        self.focus = Focus::Queue;
        self.queue_cursor = 0;
        self.warning = None;
    }

    pub fn retry_failed(&mut self) {
        if !(self.run_complete() && self.bulk_queue.iter().any(|b| b.state == BulkState::Failed)) {
            return;
        }
        for b in self.bulk_queue.iter_mut() {
            if b.state == BulkState::Failed {
                b.state = BulkState::Pending;
                b.reason = None;
            }
        }
        if let Some(r) = self.run.as_mut() {
            r.active = true;
            r.done = 0;
            r.failed = 0;
        }
        self.warning = None;
    }

    /// `x` only before a run starts (spec section 4, queue mode).
    pub fn remove_bulk(&mut self, id: usize) {
        if self.run_active() {
            return;
        }
        self.selected.remove(&id);
        self.bulk_queue.retain(|b| b.entry_id != id);
        self.warning = None;
    }

    /// Actionable rows in the Queue panel, in display order.
    pub fn queue_rows(&self) -> Vec<QueueRow> {
        let mut rows = Vec::new();
        if self.run.is_some() {
            for b in &self.bulk_queue {
                rows.push(QueueRow { kind: QueueRowKind::Bulk(b.entry_id) });
            }
        } else {
            for id in &self.selected {
                rows.push(QueueRow { kind: QueueRowKind::Bulk(*id) });
            }
        }
        for (id, _) in &self.dl {
            rows.push(QueueRow { kind: QueueRowKind::Direct(*id) });
        }
        rows
    }

    pub fn queue_move(&mut self, delta: isize) {
        let len = self.queue_rows().len() as isize;
        if len == 0 {
            self.queue_cursor = 0;
            return;
        }
        self.queue_cursor = (self.queue_cursor as isize + delta).clamp(0, len - 1) as usize;
    }

    pub fn queue_entry(&self) -> Option<usize> {
        let rows = self.queue_rows();
        rows.get(self.queue_cursor).map(|r| match r.kind {
            QueueRowKind::Bulk(id) | QueueRowKind::Direct(id) => id,
        })
    }

    pub fn open_overlay(&mut self, f: Focus) {
        self.focus_before_overlay = self.focus;
        self.focus = f;
    }

    pub fn close_overlay(&mut self) {
        self.focus = self.focus_before_overlay;
    }

    /// One quit prompt covers all pending work (spec 5.6).
    pub fn request_quit(&mut self) {
        let direct_pending = self.dl.iter().any(|(_, s)| !s.terminal());
        let bulk_pending = !self.selected.is_empty() && !self.run_complete();
        if direct_pending || self.run_active() || bulk_pending {
            self.open_overlay(Focus::Quit);
        } else {
            self.should_exit = true;
        }
    }

    pub fn focus_search(&mut self) {
        self.search_draft = self.search_value.clone();
        self.hist_idx = None;
        self.focus = Focus::Search;
    }

    pub fn submit_search(&mut self) {
        if self.search_draft.chars().count() < 3 {
            self.warn("Search query must be at least 3 characters");
            return;
        }
        let q = self.search_draft.trim().to_string();
        self.search_history.retain(|h| h != &q);
        self.search_history.insert(0, q.clone());
        self.search_history.truncate(10);
        self.search_value = q;
        // Bulk selection, direct downloads and progress survive the search
        // (spec 5.4 submitSearchFromBrowse).
        self.page = 1;
        self.cursor = 0;
        self.list_start = 0;
        self.entries = crate::mock::page_entries(1);
        self.loading_ticks = 10;
        self.focus = Focus::List;
        self.hist_idx = None;
        self.next_ready = true;
        self.warning = None;
    }

    pub fn hist_up(&mut self) {
        if self.search_history.is_empty() {
            return;
        }
        let idx = match self.hist_idx {
            Some(i) => (i + 1).min(self.search_history.len() - 1),
            None => 0,
        };
        self.hist_idx = Some(idx);
        self.search_draft = self.search_history[idx].clone();
    }

    pub fn hist_down(&mut self) {
        match self.hist_idx {
            Some(0) | None => {
                self.hist_idx = None;
                self.search_draft = self.search_value.clone();
            }
            Some(i) => {
                self.hist_idx = Some(i - 1);
                self.search_draft = self.search_history[i - 1].clone();
            }
        }
    }

    // ----- fake backend: one tick advances the mock downloads -----

    pub fn tick(&mut self) {
        self.tick_n += 1;
        if self.loading_ticks > 0 {
            self.loading_ticks -= 1;
        }

        // Promote the first queued direct download when nothing is active.
        let active = self.dl.iter().any(|(_, s)| matches!(s, DlState::Downloading { .. }));
        if !active {
            let next = self.dl.iter().find(|(_, s)| *s == DlState::Queued).map(|(i, _)| *i);
            if let Some(id) = next {
                self.set_dl(id, DlState::Downloading { progress: 0, done_mb: 0.0 });
            }
        }

        // Advance active direct downloads (~12s to finish at 3%/tick).
        let totals: Vec<(usize, f32)> = self
            .dl
            .iter()
            .filter(|(_, s)| matches!(s, DlState::Downloading { .. }))
            .map(|(id, _)| (*id, self.entry(*id).map(|e| e.size_mb as f32).unwrap_or(1.0)))
            .collect();
        for (id, total) in totals {
            if let Some((_, s)) = self.dl.iter_mut().find(|(i, _)| *i == id) {
                if let DlState::Downloading { progress, done_mb } = s {
                    *progress = (*progress + 3).min(100);
                    *done_mb = total * (*progress as f32) / 100.0;
                }
            }
            if matches!(self.dl_of(id), Some(DlState::Downloading { progress: 100, .. })) {
                self.set_dl(id, DlState::Done);
            }
        }

        // Bulk run: advance the in-flight item, or promote the next pending
        // one. Mock rule: the second item of the run fails (spec 5.3).
        if self.run_active() {
            let inflight = self.bulk_queue.iter().position(|b| matches!(b.state, BulkState::Downloading { .. }));
            let next_pending = self.bulk_queue.iter().position(|b| b.state == BulkState::Pending);
            let idx = inflight.or(next_pending);
            if let Some(idx) = idx {
                let run_len = self.bulk_queue.len();
                let next = match self.bulk_queue[idx].state {
                    BulkState::Pending => BulkState::Downloading { progress: 15 },
                    BulkState::Downloading { progress } => {
                        let p = progress + 15;
                        if p >= 100 {
                            if idx == 1.min(run_len.saturating_sub(1)) {
                                BulkState::Failed
                            } else {
                                BulkState::Done
                            }
                        } else {
                            BulkState::Downloading { progress: p }
                        }
                    }
                    other => other,
                };
                self.bulk_queue[idx].state = next;
                if next == BulkState::Failed {
                    self.bulk_queue[idx].reason = Some("mirror-a: timed out · mirror-b: HTTP 502".into());
                    self.run.as_mut().unwrap().failed += 1;
                } else if next == BulkState::Done {
                    self.run.as_mut().unwrap().done += 1;
                }
            }
            // Run complete when nothing pending or in flight: settle it.
            let still_busy = self
                .bulk_queue
                .iter()
                .any(|b| matches!(b.state, BulkState::Pending | BulkState::Downloading { .. }));
            if !still_busy {
                if let Some(r) = self.run.as_mut() {
                    r.active = false;
                }
                // settleBulkRun: completed entries deselected, failed stay.
                let done_ids: Vec<usize> = self
                    .bulk_queue
                    .iter()
                    .filter(|b| b.state == BulkState::Done)
                    .map(|b| b.entry_id)
                    .collect();
                for id in done_ids {
                    self.selected.remove(&id);
                }
            }
        }
    }
}
