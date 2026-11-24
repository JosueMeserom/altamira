# Altamira

*[Read in English](README.md)*

Una pequeña colección de userscripts. El nombre viene de la cueva de Altamira: pinturas hechas sobre una pared que ya estaba ahí, que es lo que hace un userscript con una página ajena.

## Scripts

| Script | Qué hace | Instalar |
|---|---|---|
| [Buscador en listas de YouTube](#buscador-en-listas-de-youtube) | Busca en todos los vídeos de una lista de YouTube sin hacer scroll | [Instalar](https://raw.githubusercontent.com/JosueMeserom/altamira/main/youtube-playlist-search/youtube-playlist-search.user.js) |
| [Audio original en YouTube](#audio-original-en-youtube) | Reproduce siempre el audio original de cada vídeo, nunca un doblaje | [Instalar](https://raw.githubusercontent.com/JosueMeserom/altamira/main/youtube-original-audio/youtube-original-audio.user.js) |

Para instalar uno hace falta un gestor de userscripts como [Violentmonkey](https://violentmonkey.github.io/) o [Tampermonkey](https://www.tampermonkey.net/). Pulsa **Instalar** y el gestor te ofrecerá añadirlo; las actualizaciones llegan solas.

## Buscador en listas de YouTube

Buscar un vídeo en una lista larga con Ctrl+F solo funciona con los vídeos que estén cargados en ese momento. Este script añade a cualquier página de lista un buscador que mira en **toda** la lista, también en *Vídeos que me gustan* y *Ver más tarde*.

- **Sin scroll.** Pide la lista a YouTube igual que lo hace la página al bajar, 100 vídeos por petición, así que una lista de unos cientos de vídeos se lee en uno o dos segundos.
- **No estorba.** Asoma una pestaña pequeña en el borde derecho. Al pulsarla el buscador se despliega, y se recoge con otro clic. Marca *Recordar abierto o cerrado* para que se quede como lo dejaste.
- **Título, canal y, si quieres, descripción.** Ignora tildes y mayúsculas, y tienen que coincidir todas las palabras que escribas.
- **Con caché.** Volver a una lista cuesta una sola petición: si sus 100 primeros vídeos son los mismos, se usa la copia guardada. *Volver a escanear* fuerza una lectura nueva.
- **En español e inglés**, según el idioma de YouTube.
- No depende del diseño de la página, así que funciona con el diseño antiguo y con el nuevo.

### A tener en cuenta

- **Las descripciones tardan la primera vez.** No vienen con la lista, así que cada vídeo necesita su propia petición. En una lista de miles de vídeos eso lleva un rato, y YouTube puede frenarte. Se guardan para siempre, así que solo se espera una vez. Por eso la opción viene desmarcada.
- **Los cambios al fondo de una lista pueden pasar desapercibidos.** Si quitas un vídeo antiguo y los 100 primeros no cambian, sigue saliendo hasta que pulses *Volver a escanear*.
- **YouTube solo enseña los 5.000 «me gusta» más recientes.** El script no puede ver más allá.
- Usa la API interna de YouTube, que puede cambiar sin avisar. Si el buscador deja de funcionar, [abre una incidencia](https://github.com/JosueMeserom/altamira/issues).

### Privacidad

Todo se queda en tu navegador. El script solo habla con `youtube.com`, con tu propia sesión, y guarda su caché en el almacenamiento del navegador para ese sitio. No se envía nada a ningún otro lugar.

## Audio original en YouTube

Cuando tu idioma no es el del vídeo, YouTube puede poner un doblaje en lugar de la voz original: uno automático hecho con IA o uno que ha subido el creador. Este script hace que todos los vídeos empiecen con su pista de audio original.

- **Antes de que empiece el vídeo.** En cuanto el reproductor recibe un vídeo nuevo, antes del primer fotograma, el script le pide que use la pista marcada como original. Nada se reinicia y no se oye el cambio.
- **Sin cargas extra.** No hace peticiones a la red ni toca los datos de YouTube: solo habla con el reproductor que ya está ahí. En las pruebas, los vídeos que necesitaban el cambio arrancaron alrededor de una décima de segundo más tarde que sin el script.
- **Manda tu elección.** Solo actúa durante el primer segundo y medio de cada vídeo nuevo, empiece donde empiece (un enlace con `&t=`, o YouTube retomándolo donde lo dejaste). Si eliges otra pista a mano, se queda hasta el siguiente vídeo, aunque vuelvas al principio o lo pongas en bucle.
- Páginas de vídeo, Shorts y reproductores incrustados en otras webs.

### A tener en cuenta

- Si un vídeo no tiene ninguna pista marcada como original, el script no lo toca.
- Depende de la API del reproductor de YouTube y de cómo etiqueta sus pistas. Si YouTube cambia alguna de las dos cosas, puede dejar de funcionar: [abre una incidencia](https://github.com/JosueMeserom/altamira/issues).

## Licencia

[MIT](LICENSE)

## Otros proyectos

- [Bayeux: copiar enlace de la tira](https://github.com/JosueMeserom/bayeux/blob/main/tools/bayeux.user.js): un userscript que añade un botón a cada post de X para copiar su enlace de [Bayeux](https://github.com/JosueMeserom/bayeux). Bayeux es un servicio autoalojado que cose las imágenes de un post en una sola tira horizontal, por eso el script vive en su repositorio.
