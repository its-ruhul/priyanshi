# For you 💌

A small three-page website: a home scene, a handwritten letter, and a photo memory carousel, with background music.
Everything you'll want to change is in **`data.json`**. You don't need to touch the HTML, CSS or JS.

```
index.html      the page
data.json       ALL text, photos and songs
css/style.css   looks
js/app.js       behaviour
photos/         put your photos here
music/          put your songs here
fonts/          handwriting + UI fonts (bundled, works offline)
```

---

## 1. Names

```json
"names": { "her": "My Love", "him": "Abhay" }
```

Anywhere in `data.json` you can write `{her}` or `{him}` and it gets replaced with these names.

## 2. Photos (Memories page)

1. Drop your photos into the `photos/` folder.
2. Add one entry per photo in `memories.items`. You can have as many as you like, in any order:

```json
{
  "photo": "photos/beach.jpg",
  "caption": "Goa, our first trip",
  "date": "March 2025",
  "message": "You fell asleep on my shoulder on the bus back. I didn't move for two hours."
}
```

- `caption` goes on the bottom of the polaroid (keep it short).
- `message` shows as a text message next to the photo. Line breaks with `\n` work.
- `date` is optional. Leave it `""` to hide it.
- `memories.autoplaySeconds` sets how long each photo stays before moving on.

Tips: portrait photos look best (they're cropped to 4:5). Resize them to about 1200px on the long side so they load fast on her phone. iPhone `.HEIC` photos need converting to `.jpg` first.

**File names are case-sensitive once it's online.** `Photo1.JPG` and `photo1.jpg` are different files on most hosting.

## 3. Music

1. Put `.mp3` files in the `music/` folder.
2. List them in `music.tracks`:

```json
"music": {
  "volume": 0.5,
  "shuffle": false,
  "tracks": [
    { "title": "Our song", "file": "music/our-song.mp3" },
    { "title": "The one from the cafe", "file": "music/cafe.mp3" }
  ]
}
```

- Songs play in order and loop. A "next" button appears when there's more than one.
- The song title pops up at the bottom when it starts playing.
- Browsers don't allow sound until someone taps the page. That's why the site opens with a heart to tap: that tap starts the music.
- If a file is missing, the music button simply hides (the reason is printed in the browser console).

## 4. The letter

Edit `letter.paragraphs` (one string per paragraph), plus `greeting`, `closing`, `signature` and `postscript`.
Leave `letter.date` as `""` to show today's date, or write your own.

The letter writes itself word by word as she scrolls. Tapping the paper shows it all at once.

## 5. "Do you forgive me?"

After the letter there's a Yes / No question. The No button runs away and changes its text each time (from `forgive.noReplies`), while Yes gets bigger.
Set `"enabled": false` to turn it off.

## 6. Days-together counter (optional)

```json
"site": { "togetherSince": "2024-02-14" }
```

Use the format `YYYY-MM-DD`. The home page then counts up to "N days of us, and counting" (text in `home.togetherText`). Leave it `""` to hide it.

---

## Previewing it on your computer

Opening `index.html` by double-clicking **won't work**, because browsers block a page opened from a folder from reading `data.json`. Use any small local server instead:

- **VS Code:** install the *Live Server* extension, right-click `index.html` → *Open with Live Server*.
- **Python:** in this folder run `python -m http.server 8000`, then open http://localhost:8000
- **Node:** `npx serve .`

To check it on your phone, connect to the same Wi‑Fi and open `http://<your-computer's-IP>:8000`.

## Putting it online

Upload the **whole folder** as it is. Any static hosting works:

- **Netlify Drop** (fastest): go to app.netlify.com/drop and drag the folder in. You get a link right away.
- **GitHub Pages:** push the folder to a repo, then Settings → Pages → deploy from the main branch.
- **Hostinger / any cPanel host:** upload the contents into `public_html` (or a subfolder like `public_html/for-you`).

## If something looks wrong

- **The opening screen says "data.json has a typo":** a comma or quote is missing in `data.json`. The message tells you roughly where. A common mistake is a comma after the last item in a list. Pasting the file into jsonlint.com shows the exact line.
- **A photo shows "Photo 3, add it in the photos folder":** the file name in `data.json` doesn't match the real file (check capitals and the extension).
- **No music button:** none of the songs could be found. Check the `file` paths.

Animations respect the phone's "reduce motion" setting automatically.
