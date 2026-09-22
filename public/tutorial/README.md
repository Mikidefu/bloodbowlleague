# Video del tutorial

Qui dentro vanno i video animati delle pillole (MP4 H.264 o WebM, larghezza consigliata 960px, senza audio indispensabile).

Per collegare un video a una pillola basta aggiungere il campo `video` alla pillola in
`src/lib/tutorial.ts`, con il solo nome del file:

```ts
{
  id: 'campo',
  page: 'p. 23',
  diagram: 'pitch',
  video: 'campo.mp4',   // -> public/tutorial/campo.mp4
  ...
}
```

Se il campo `video` non c'è, la pillola mostra soltanto il diagramma SVG.
I diagrammi si trovano in `src/components/tutorial/TutorialDiagram.tsx`.
