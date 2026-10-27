# LuckyTab

LuckyTab is a personalized custom new-tab page for browsers. It works well with extensions such as [New Tab Override](https://addons.mozilla.org/firefox/addon/new-tab-override/) and provides search, pinned sites, history, translation, system information, and small quality-of-life utilities in one page.

The default styling and utilities are intentionally biased toward my own workflow. The page is also designed to be fully customizable, so other users can enable or disable tools, change themes, edit pinned sites, and add custom CSS from Settings.

## Features

- Multiple search providers with provider shortcuts such as `yt`, `maps`, `aks`, and `wiki`
- Search suggestions from history and pinned sites
- Math evaluation and clipboard shortcuts
- Optional URL safety checks with Google Safe Browsing
- Pinned sites and visit/search history
- Translator widget
- System information widget with configurable values
- Responsive layouts that collapse secondary content when space is limited
- Theme presets and custom CSS

## Custom CSS

Open Settings and add CSS in the Custom CSS field. The following variables are used by the app and are useful starting points for a custom color theme:

### Colors

```css
--text
--placeholder
--primary
--primary-700
--primary-800
--primary-900
--secondary-700
--secondary-800
--secondary-900
--tertiary-800
--quaternary
--quaternary-800
--red
--green
--blue
--cyan
--yellow
--magenta
```

### Surfaces, controls, and layout

```css
--container
--card
--background
--dark-400
--dark-600
--button
--button-hover
--button-text
--button-border
--button-opacity
--container-padding
--container-border-radius
--card-padding
--card-border-radius
--border-radius
```

Example theme:

```css
:root {
	--text: #f2eee8;
	--placeholder: #9b9b8a;
	--background: #151d15;
	--container: #1b281b;
	--card: #243324;
	--primary: #78865e;
	--primary-700: #65714f;
	--primary-800: #515c40;
	--primary-900: #3b432f;
	--secondary-700: #9f8f86;
	--secondary-800: #82746d;
	--secondary-900: #625851;
	--tertiary-800: #5e7158;
	--quaternary: #b09a78;
	--quaternary-800: #796746;
	--red: #bd6f64;
	--green: #78865e;
	--blue: #68765f;
	--cyan: #738b7c;
	--yellow: #b09a78;
	--magenta: #9f8f86;
	--dark-400: #4d5a48;
	--dark-600: #303e30;
	--button: #3a4938;
	--button-hover: #4a5b45;
	--button-text: #f2eee8;
	--button-border: #667458;
	--button-opacity: 0.9;
	--container-padding: 1.5rem;
	--container-border-radius: 0.5rem;
	--card-padding: 1rem;
	--card-border-radius: 0.5rem;
	--border-radius: 0.5rem;
}

/* CleanUI semantic classes use fixed palette colors by default. */
.primary,
button.primary,
button.hollow.primary,
.secondary,
button.secondary,
button.hollow.secondary,
.tertiary,
button.tertiary,
button.hollow.tertiary,
.quaternary,
button.quaternary,
button.hollow.quaternary {
	background: var(--button);
	border-color: var(--button-border);
	color: var(--button-text);
}

.primary:hover,
button.primary:hover,
button.hollow.primary:hover,
.secondary:hover,
button.secondary:hover,
button.hollow.secondary:hover,
.tertiary:hover,
button.tertiary:hover,
button.hollow.tertiary:hover,
.quaternary:hover,
button.quaternary:hover,
button.hollow.quaternary:hover {
	background: var(--button-hover);
	color: var(--button-text);
}

section,
.container {
	background: var(--container);
	border-color: var(--dark-400);
	color: var(--text);
}

.card {
	background: var(--card);
	border-color: var(--dark-400);
	color: var(--text);
}

/* Keep destructive actions visibly distinct. */
.red,
.red:hover,
button.red,
button.hollow.red,
button.red:hover,
button.hollow.red:hover {
	background: var(--red);
}
```

CleanUI defines additional color scales and spacing/control variables. The list above includes variables used by LuckyTab plus the main tokens that affect CleanUI containers, cards, buttons, and default spacing.

### Custom background image

Users can set a custom background image with CSS. Replace the image URL with any image they want to use:

```css
#lt-bg {
	background-image: url("https://example.com/image.png");
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
}
```

## Development

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Run checks and create a production build:

```sh
npm run check
npm run build
npm run preview
```

LuckyTab is built with SvelteKit and uses [CleanUI](https://github.com/LuckyLuuk12/CleanUI) for its base design tokens and components.
