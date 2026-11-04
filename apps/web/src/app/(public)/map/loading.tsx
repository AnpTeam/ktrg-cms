import Loading from "../loading";

// The map's own loading screen: the ordinary one, plus the `map-screen` marker that globals.css uses to lock the page
// from scrolling. Without it a swipe during the wait scrolled the page, and the map then came up on a page that was
// already shifted (only a reopen put it back).
export default async function MapLoading() {
  return (
    <>
      <div aria-hidden="true" className="map-screen" />
      <Loading />
    </>
  );
}
