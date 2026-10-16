# Family History Photos
Mom's Family Photo Album, Duplicate Cleaner, 4K Image Restorer & Memory Keeper.

This application provides a fast, offline-first photo organizer with face recognition and 4K restoration.

The local restorer is the default and keeps photos on this device. Fal.ai cloud models upload a photo only after you confirm. OneDrive import needs your own Microsoft app id: [docs/ONEDRIVE_SETUP.md](docs/ONEDRIVE_SETUP.md). Security notes, including FamilySearch guidance that is not implemented yet, are in [SECURITY.md](SECURITY.md). The published site is `https://jviola60.github.io/family-history-photos/`.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
