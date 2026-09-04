import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { isImagePreloaded, preloadImage } from "../utils/imagePreloader";

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  retainAcrossScreens?: boolean;
  onDisplayed?: (src: string) => void;
};

let lastPaintedSceneSource: string | null = null;

/** Keeps two permanent image layers so a scene background is never exposed. */
export default function SmoothSceneImage({
  src,
  retainAcrossScreens = false,
  onDisplayed,
  decoding: _decoding,
  onLoad,
  style,
  ...props
}: Props) {
  const [sources, setSources] = useState<[string, string | null]>(() => {
    const retainedSource = retainAcrossScreens ? lastPaintedSceneSource : null;
    return retainedSource && retainedSource !== src
      ? [retainedSource, src]
      : [src, null];
  });
  const [activeLayer, setActiveLayer] = useState(0);
  const layerElements = useRef<[HTMLImageElement | null, HTMLImageElement | null]>([null, null]);
  const requestedSource = useRef(src);
  requestedSource.current = src;

  // Most story frames are preloaded before the player advances. Swap those
  // decoded frames in a layout effect so the previous frame never receives an
  // extra browser paint. Cross-screen retention remains opt-in only.
  useLayoutEffect(() => {
    if (sources[activeLayer] === src) return;
    const requestedLayer = sources.findIndex(source => source === src);
    if (requestedLayer < 0) {
      if (!isImagePreloaded(src)) return;
      const waitingLayer = activeLayer === 0 ? 1 : 0;
      setSources(current => {
        const next: [string, string | null] = [...current];
        next[waitingLayer] = src;
        return next;
      });
      return;
    }

    // A decoded Image() request and the actual DOM <img> do not always become
    // paintable in the same browser task. Only reveal the requested layer once
    // its own element confirms it has pixels, otherwise a one-frame black
    // compositor flash is possible even though the network preload succeeded.
    const element = layerElements.current[requestedLayer];
    if (!element?.complete || element.naturalWidth === 0) return;
    setActiveLayer(requestedLayer);
    if (retainAcrossScreens) lastPaintedSceneSource = src;
    onDisplayed?.(src);
  }, [activeLayer, onDisplayed, retainAcrossScreens, sources, src]);

  useEffect(() => {
    if (sources[activeLayer] === src) return;

    let active = true;
    void preloadImage(src, "high").then(() => {
      if (!active || requestedSource.current !== src) return;
      const alreadyLoadedLayer = sources.findIndex((source) => source === src);
      if (alreadyLoadedLayer >= 0) {
        const element = layerElements.current[alreadyLoadedLayer];
        // Returning to a previously displayed source does not fire another
        // load event, but it is safe to switch only if that DOM layer is still
        // demonstrably paintable.
        if (element?.complete && element.naturalWidth > 0 && active && requestedSource.current === src) {
          if (retainAcrossScreens) lastPaintedSceneSource = src;
          setActiveLayer(alreadyLoadedLayer);
          onDisplayed?.(src);
        }
        return;
      }
      const waitingLayer = activeLayer === 0 ? 1 : 0;
      setSources((current) => {
        if (current[waitingLayer] === src) return current;
        const next: [string, string | null] = [...current];
        next[waitingLayer] = src;
        return next;
      });
    });

    return () => {
      active = false;
    };
  }, [activeLayer, sources, src]);

  const handleLayerLoad = (
    event: React.SyntheticEvent<HTMLImageElement>,
    layer: number,
    layerSource: string,
  ) => {
    onLoad?.(event);
    if (layer === activeLayer) {
      if (retainAcrossScreens && layerSource === requestedSource.current) {
        lastPaintedSceneSource = layerSource;
      }
      if (layerSource === requestedSource.current) onDisplayed?.(layerSource);
      return;
    }
    if (layerSource !== requestedSource.current) return;

    const image = event.currentTarget;
    void image.decode().catch(() => undefined).then(() => {
      if (requestedSource.current === layerSource) {
        if (retainAcrossScreens) lastPaintedSceneSource = layerSource;
        setActiveLayer(layer);
        onDisplayed?.(layerSource);
      }
    });
  };

  return (
    <>
      {sources.map((layerSource, layer) => layerSource ? (
        <img
          {...props}
          key={layer}
          ref={(element) => { layerElements.current[layer] = element; }}
          src={layerSource}
          decoding="async"
          fetchPriority="high"
          onLoad={(event) => handleLayerLoad(event, layer, layerSource)}
          style={{
            ...style,
            // Keeping both decoded layers painted prevents a one-frame black
            // compositor flash while the browser switches scene bitmaps.
            visibility: "visible",
            opacity: layer === activeLayer ? 1 : 0,
            pointerEvents: layer === activeLayer ? undefined : "none",
          }}
          aria-hidden={layer !== activeLayer || props.alt === "" ? true : undefined}
        />
      ) : null)}
    </>
  );
}
