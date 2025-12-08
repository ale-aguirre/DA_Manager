# LADYMANAGER: Arquitectura y Reglas de Negocio

Este documento define la verdad absoluta del proyecto. Cualquier código nuevo debe cumplir estas directrices.

## 1. Misión del Sistema
LadyManager es un orquestador de Stable Diffusion enfocado en la **venta de contenido** (DeviantArt/Patreon). Prioriza la calidad técnica, la coherencia del personaje y la eficiencia en el flujo de trabajo (Secuencias).

## 2. El Motor de Generación (Smart Hybrid)
El sistema utiliza un enfoque híbrido para generar prompts:
1.  **Cerebro IA (Ollama/Groq):** Genera "Escenarios" (JSON con Outfit, Pose, Location) basados en el conocimiento del personaje.
2.  **El Capataz (Backend Logic):** Recibe el JSON y aplica reglas inquebrantables de intensidad y estilo.

### Reglas de Intensidad (The Strip Logic)
La intensidad seleccionada por el usuario SIEMPRE sobrescribe la ropa:
* **SFW:**
    * *Default:* Outfit = `""` (Vacío). Se respeta el outfit original del LoRA.
    * *Remix:* Se permite inyectar outfits casuales/temáticos.
* **ECCHI:**
    * **Acción:** Forzar cambio de ropa.
    * *Outfit:* Lencería (`sexy lingerie, lace...`) o vestuario sugerente.
* **NSFW:**
    * **Acción:** Desnudo total.
    * *Outfit:* `nude, naked, no clothes`. Se elimina cualquier referencia a ropa anterior.

### Reglas de Secuencia (The Sales Funnel)
El modo "SEQUENCE" genera tríos de imágenes para crear narrativa de venta:
1.  **Regla de Oro:** Las 3 imágenes (SFW -> ECCHI -> NSFW) comparten la misma `Seed`, `Pose Base` y `Location`.
2.  **Variación:** Solo cambia el `Outfit` y la `Expression` (siguiendo la Strip Logic).

## 3. Gestión de Recursos (Resource Manager)
El sistema no debe depender de nombres de archivo crudos (`xy_v1.safetensors`).
* **Sistema de Alias:** Los usuarios pueden asignar nombres humanos ("Estilo Acuarela") a los archivos.
* **Metadata Sidecar:** Cada LoRA puede tener un `.json` o `.civitai.info` asociado con sus triggers y alias.
* **Interfaz Visual:** El Frontend debe mostrar tarjetas visuales (imágenes de preview), no listas de texto.

## 4. Memoria y Aprendizaje (Favorites RAG)
El sistema debe aprender de los éxitos del usuario.
* **Mecanismo:** Guardar prompts/seeds de imágenes marcadas como "Favoritas".
* **Uso:** Al generar, la IA consulta estos favoritos para replicar el estilo o la composición que ya funcionó.

## 5. Estructura de Archivos Intocable
* `backend/resources/`: Contiene listas curadas (`poses/`, `wardrobe/`). NO borrar ni llenar con basura generada.
* `docs/`: Documentación viva.
