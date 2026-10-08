# SnacMan

A Pac-Man-style game: 12 levels, three kinds of monsters, lava, donuts (invincibility), ghost peppers (walk through walls) and 8 hats.
*(Definitely not Pac-Man.)*

Originally a Java Swing school project by **Chidera, Neil, Ethan and Moses**; this is a faithful JavaScript/canvas port that runs in the browser.

## Play
Arrow keys or WASD to move; on touch devices press and hold anywhere on the screen and the character walks toward your finger. Eat every dot to clear a level.
High scores and lifetime stats are stored in your browser (localStorage).

## Run locally
No build step. Serve the folder over HTTP (ES modules don't work from `file://`):

    python -m http.server 8000

then open http://localhost:8000. Add `?level=N` to jump straight into a level.

## Tests
    node --test tests/

## Deploy
Static files only, so it works on GitHub Pages as-is (`.nojekyll` included).
