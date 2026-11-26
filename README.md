# ChartTropy

Motor de gráficos financieros para navegador, con Canvas 2D. El banco de pruebas usa la misma vista para el histórico, el replay y la reproducción de un flujo simulado. Incluye navegación suave o por velas, zoom táctil y eventos asociados a cada vela.

## Abrir el banco

Desde la raíz de ChartTropy, genera la vista autónoma:

```powershell
python tools/export-demo.py
```

Abre `dist/ChartTropy.html` en el navegador. Incluye el motor, los estilos y un ejemplo sintético de 12.000 velas. **Abrir grabación** acepta un archivo JSON con el formato descrito abajo. La grabación se lee en el navegador.

Para editar el código con un servidor local, ejecuta `python -m http.server 8764 --bind 127.0.0.1` desde la raíz y abre [el banco de pruebas](http://127.0.0.1:8764/demo/).

## Grabación v1

```json
{
  "version": 1,
  "symbol": "EUR/USD",
  "timeframe": "M1",
  "priceDigits": 5,
  "candles": [{"time": 1794902400000, "open": 1.08450, "high": 1.08493, "low": 1.08430, "close": 1.08471}],
  "events": [{"time": 1794902400000, "kind": "signal", "price": 1.08471, "label": "Señal", "detail": "Cierre sobre la media."}]
}
```

Cada `time` es la apertura de una vela en milisegundos UTC. Las velas vienen ordenadas por tiempo y tienen identificadores únicos. Un evento se ancla a una vela y puede ser `signal`, `entry`, `stop`, `target`, `exit` o `cancel`. El replay presenta los eventos hasta la vela seleccionada. Los niveles activos representan una operación por grabación en este prototipo.

`src/candle-chart.mjs` contiene el renderizador y la navegación. `src/recording.mjs` valida el contrato y construye los índices de vela y eventos. Los controles y los datos de ejemplo viven en `demo/`.

Ejecuta `node --test` desde la raíz para comprobar el orden de las velas, el avance de los eventos y los niveles activos.

## Desarrollo

Validar la interacción táctil, ampliar la personalización del eje de precio y probar actualizaciones incrementales con una fuente de datos reproducible. El contrato de grabación se valida en el banco de pruebas antes de integrarlo en otros productos.
