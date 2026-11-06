/** Stub mínimo pra assar ninhos/mapa no Node (texturasAgua3d). */
if (typeof globalThis.document === "undefined") {
  globalThis.document = {
    createElement() {
      const ctx = {
        fillRect() {},
        clearRect() {},
        drawImage() {},
        getImageData() {
          return { data: new Uint8ClampedArray(4), width: 1, height: 1 };
        },
        putImageData() {},
        createLinearGradient() {
          return { addColorStop() {} };
        },
        createRadialGradient() {
          return { addColorStop() {} };
        },
        fillStyle: "",
        strokeStyle: "",
        globalAlpha: 1,
        canvas: null,
      };
      const canvas = {
        width: 1,
        height: 1,
        style: {},
        getContext() {
          return ctx;
        },
      };
      ctx.canvas = canvas;
      return canvas;
    },
  };
}
if (typeof globalThis.Image === "undefined") {
  globalThis.Image = class Image {};
}
