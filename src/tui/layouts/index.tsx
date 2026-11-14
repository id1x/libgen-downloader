import { Layout } from "./layout";
import { LAYOUT_KEY } from "./keys";
import Search from "./search/index";
import { BrowseLayout } from "./browse/index";
import { BulkDownload } from "./bulk-download";

export function Layouts() {
  return (
    <>
      <Layout layoutName={LAYOUT_KEY.SEARCH_LAYOUT}>
        <Search />
      </Layout>

      <Layout layoutName={LAYOUT_KEY.BROWSE_LAYOUT}>
        <BrowseLayout />
      </Layout>

      {/* CLI mode still renders the old bulk screen (spec §5.8). */}
      <Layout layoutName={LAYOUT_KEY.BULK_DOWNLOAD_LAYOUT}>
        <BulkDownload />
      </Layout>
    </>
  );
}
