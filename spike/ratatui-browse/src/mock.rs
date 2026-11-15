// PROTOTYPE — mock data for the ratatui spike. Throwaway.
use crate::state::Entry;

/// 25 fake entries per page (spec section 8.1 uses 25/page, 3 pages).
pub fn page_entries(page: usize) -> Vec<Entry> {
    let data: [(&str, &str, &str, u32, &str, u32, u32, &str); 25] = [
        ("Practical Systems Programming", "A. Lindqvist; M. Reyes", "epub", 6, "Harbor Books", 2018, 312, "English"),
        ("Concurrency Patterns in Depth", "R. Takahashi", "pdf", 14, "Harbor Books", 2019, 388, "English"),
        ("The Pragmatic Compiler", "E. Moreau", "pdf", 9, "Northgate Press", 2020, 264, "English"),
        ("Data Structures Field Guide", "J. Okafor", "epub", 3, "Harbor Books", 2017, 198, "English"),
        ("Networks From First Principles", "S. Varga; P. Engel", "pdf", 22, "Northgate Press", 2021, 512, "English"),
        ("Designing Terminal Interfaces", "L. Brandt", "mobi", 2, "Harbor Books", 2019, 176, "English"),
        ("Memory Safety Without Tears", "K. Nakamura", "epub", 5, "Northgate Press", 2022, 240, "English"),
        ("An Introduction to Type Theory", "D. Halvorsen", "djvu", 11, "Harbor Books", 2016, 430, "English"),
        ("Operating Systems: A Workbook", "T. Adeyemi", "pdf", 31, "Northgate Press", 2018, 604, "English"),
        ("Functional Thinking, Applied", "M. Castillo", "epub", 4, "Harbor Books", 2020, 210, "English"),
        ("Distributed Logs and Ledger Design", "H. Kowalski", "pdf", 17, "Northgate Press", 2021, 366, "English"),
        ("Refactoring Legacy Python", "O. Brennan", "epub", 3, "Harbor Books", 2019, 232, "English"),
        ("Algorithms for the Working Programmer", "N. Haddad", "pdf", 12, "Northgate Press", 2017, 348, "English"),
        ("Parser Combinators in Practice", "F. Duval", "pdf", 8, "Harbor Books", 2022, 276, "English"),
        ("The Little Book of Scheduling", "A. Petrov", "epub", 2, "Northgate Press", 2020, 154, "English"),
        ("Databases Under Load", "S. Whitmore", "pdf", 19, "Harbor Books", 2018, 470, "English"),
        ("Cryptography for Developers", "J. Mensah", "epub", 7, "Northgate Press", 2021, 298, "English"),
        ("Debugging Across Time Zones", "C. Alvarez", "mobi", 1, "Harbor Books", 2019, 142, "English"),
        ("Formal Methods Made Friendly", "Y. Tanaka", "pdf", 15, "Northgate Press", 2020, 382, "English"),
        ("The Art of the Diff", "G. Novak", "epub", 2, "Harbor Books", 2018, 168, "English"),
        ("Stream Processing Patterns", "B. Kowalczyk", "pdf", 21, "Northgate Press", 2022, 456, "English"),
        ("Real-Time Linux Recipes", "M. Farrell", "epub", 9, "Harbor Books", 2017, 322, "English"),
        ("Compilers: A Field Manual", "I. Ström", "pdf", 26, "Northgate Press", 2019, 540, "English"),
        ("Version Control at Scale", "P. Umeh", "epub", 5, "Harbor Books", 2021, 254, "English"),
        ("The Scheduler's Companion", "R. Devi", "djvu", 10, "Northgate Press", 2020, 340, "English"),
    ];
    let suffix = if page > 1 { " (ed. 2)" } else { "" };
    data.iter()
        .enumerate()
        .map(|(i, (t, a, e, s, p, y, pg, l))| {
            let id = i + 1;
            Entry {
                id,
                title: format!("{t}{suffix}"),
                author: a.to_string(),
                ext: e.to_string(),
                size_mb: *s,
                publisher: p.to_string(),
                year: *y,
                pages: *pg,
                language: l.to_string(),
                md5: format!("{:032x}", (id as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15)),
            }
        })
        .collect()
}
