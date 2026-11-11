# Altamira

*[Leer en español](README.es.md)*

A small collection of userscripts. Named after the cave of Altamira: paintings made on a wall that was already there, which is what a userscript does to someone else's page.

## Scripts

| Script | What it does | Install |
|---|---|---|
| [YouTube Playlist Search](#youtube-playlist-search) | Search every video of a YouTube playlist without scrolling | [Install](https://raw.githubusercontent.com/JosueMeserom/altamira/main/youtube-playlist-search/youtube-playlist-search.user.js) |

To install one you need a userscript manager such as [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/). Click **Install** and the manager will offer to add it; updates arrive on their own.

## YouTube Playlist Search

Finding one video in a long playlist with Ctrl+F only works on the videos that happen to be loaded. This script adds a search box to every playlist page that looks through **all** of it, including *Liked videos* and *Watch later*.

- **No scrolling.** It asks YouTube for the playlist the same way the page does while you scroll, 100 videos per request, so a list of a few hundred videos is read in a second or two.
- **Out of the way.** A small tab sits at the right edge of the page. Click it to slide the search box out, and again to hide it. Tick *Remember open or closed* to keep it the way you left it.
- **Title, channel and, optionally, description.** Accents and case are ignored, and every word you type has to match.
- **Cached.** Coming back to a playlist costs a single request: if its first 100 videos are the same, the saved copy is used. *Rescan* forces a fresh read.
- **English and Spanish**, following YouTube's language.
- It does not depend on the page layout, so it works with the old and the new YouTube design.

### Things to know

- **Descriptions are slow the first time.** They are not part of the playlist data, so each video needs its own request. For a playlist of thousands of videos that takes a while, and YouTube may throttle you. They are stored permanently, so you only wait once. That is why the option is off by default.
- **Changes deep in a playlist may go unnoticed.** If you remove an old video and the first 100 stay the same, it keeps showing up until you press *Rescan*.
- **YouTube only exposes the 5,000 most recent liked videos.** The script cannot see beyond that.
- It uses YouTube's internal API, which can change without notice. If the search stops working, please [open an issue](https://github.com/JosueMeserom/altamira/issues).

### Privacy

Everything stays in your browser. The script only talks to `youtube.com`, with your own session, and keeps its cache in the browser's storage for that site. Nothing is sent anywhere else.

## License

[MIT](LICENSE)

## Other projects

- [Bayeux: copy strip link](https://github.com/JosueMeserom/bayeux/blob/main/tools/bayeux.user.js): a userscript that adds a button to every post on X to copy its [Bayeux](https://github.com/JosueMeserom/bayeux) link. Bayeux is a self-hosted service that stitches the images of a post into a single horizontal strip, so the script lives in its repository.
