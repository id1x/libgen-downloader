// PROTOTYPE — ratatui spike for wayfinder ticket #15. Throwaway.
// Renders the master/detail BROWSE layout from
// `docs/libgen-downloader master detail TUI redesign — implementation spec.md`
// on mock data, to answer: does the spec translate cleanly to ratatui?
//
// Live:   cargo run -q            (from spike/ratatui-browse/)
// Snaps:  cargo run -q -- --snapshot 120x36 80x30 59x20 40x12
// Bulk:   cargo run -q -- --snaprun 120x36   (bulk run mid-flight)
mod keys;
mod layout_metrics;
mod mock;
mod row_status;
mod state;
mod ui;

use std::io;
use std::time::Duration;

use ratatui::backend::TestBackend;
use ratatui::buffer::Buffer;
use ratatui::crossterm::event::{self, Event, KeyCode, KeyEventKind, KeyModifiers};
use ratatui::crossterm::terminal::{
    disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen,
};
use ratatui::crossterm::execute;
use ratatui::Terminal;

use state::State;

fn main() -> io::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    let mut state = State::seed();

    if args.len() > 2 && args[1] == "--snapshot" {
        for spec in &args[2..] {
            let (w, h) = parse_size(spec).unwrap_or_else(|| panic!("bad size {spec} (want WxH)"));
            snap(&mut state, w, h, &format!("=== {w}x{h} ==="));
        }
        return Ok(());
    }
    if args.len() > 2 && args[1] == "--snaprun" {
        state.start_bulk();
        for _ in 0..25 {
            state.tick();
        }
        let (w, h) = parse_size(&args[2]).unwrap_or_else(|| panic!("bad size (want WxH)"));
        snap(&mut state, w, h, &format!("=== bulk run @ {w}x{h} ==="));
        return Ok(());
    }

    enable_raw_mode()?;
    execute!(io::stdout(), EnterAlternateScreen)?;
    let mut term = Terminal::new(ratatui::backend::CrosstermBackend::new(io::stdout()))?;
    let res = run(&mut term, &mut state);
    execute!(io::stdout(), LeaveAlternateScreen)?;
    disable_raw_mode()?;
    res
}

fn run(term: &mut Terminal<ratatui::backend::CrosstermBackend<io::Stdout>>, state: &mut State) -> io::Result<()> {
    loop {
        term.draw(|f| ui::render(f, state))?;
        if event::poll(Duration::from_millis(150))? {
            match event::read()? {
                Event::Key(k) if k.kind == KeyEventKind::Press => {
                    // Priority rule 2: ctrl+c keeps default exit behaviour.
                    if k.code == KeyCode::Char('c') && k.modifiers.contains(KeyModifiers::CONTROL) {
                        return Ok(());
                    }
                    keys::route(state, k);
                    if state.should_exit {
                        return Ok(());
                    }
                }
                Event::Resize(..) => {} // next draw recomputes the layout
                _ => {}
            }
        } else {
            state.tick();
        }
    }
}

fn snap(state: &mut State, w: u16, h: u16, header: &str) {
    let backend = TestBackend::new(w, h);
    let mut term = Terminal::new(backend).unwrap();
    term.draw(|f| ui::render(f, state)).unwrap();
    println!("{header}");
    print_buffer(term.backend().buffer());
    println!();
}

fn parse_size(s: &str) -> Option<(u16, u16)> {
    let (w, h) = s.split_once('x')?;
    Some((w.parse().ok()?, h.parse().ok()?))
}

fn print_buffer(buf: &Buffer) {
    let a = buf.area;
    for y in 0..a.height {
        let mut line = String::new();
        for x in 0..a.width {
            line.push_str(buf[(x, y)].symbol());
        }
        println!("{}", line.trim_end());
    }
}
