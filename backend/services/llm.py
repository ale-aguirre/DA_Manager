import os
import json
import random
import aiohttp
import asyncio
from typing import List, Dict, Any, Optional

# Intentar importar Groq de forma segura
try:
    from groq import Groq
except ImportError:
    Groq = None

class LLMService:
    def __init__(self):
        self.provider = os.getenv("AI_PROVIDER", "ollama").lower()
        self.ollama_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        self.ollama_model = os.getenv("OLLAMA_MODEL", "dolphin-llama3")
        self.groq_api_key = os.getenv("GROQ_API_KEY")
        self._groq_client = None

    def _get_groq_client(self):
        if not self._groq_client and self.groq_api_key and Groq:
            self._groq_client = Groq(api_key=self.groq_api_key)
        return self._groq_client

    async def generate_scenarios(self, character_name: str, count: int, context: str = "") -> List[Dict[str, str]]:
        """
        Genera una lista de escenarios visuales (Outfit+Pose+Location) para un personaje.
        Retorna siempre una lista de diccionarios, vacía si falla.
        """
        system_prompt = (
            "ROLE: Database Generator. MODE: JSON ONLY.\n"
            "TASK: Generate {count} distinct anime visual concepts for character '{character_name}'.\n"
            "FORMAT: A raw JSON List of Objects. keys: 'outfit', 'pose', 'location'.\n"
            "CONSTRAINTS:\n"
            "- NO sentences. NO descriptions like 'a beautiful girl'.\n"
            "- USE ONLY SHORT TAGS: 'white shirt, denim shorts', 'sitting, legs crossed'.\n"
            "- OUTFIT: Specific clothing names only.\n"
            "- LOCATION: Simple background descriptions.\n"
            "EXAMPLE OUTPUT:\n"
            "[{\"outfit\": \"sailor uniform, pleated skirt\", \"pose\": \"standing, saluting\", \"location\": \"classroom\"}]"
        )
        
        if context:
            system_prompt += f" CONTEXT/LORE: {context}"

        try:
            if self.provider == "groq":
                return await self._call_groq(system_prompt)
            else:
                return await self._call_ollama(system_prompt)
        except Exception as e:
            print(f"[LLM] Error generating scenarios: {e}")
            return []

    async def _call_ollama(self, prompt: str) -> List[Dict[str, str]]:
        """Llamada a Ollama API (chat) forzando JSON."""
        url = f"{self.ollama_url}/api/chat"
        payload = {
            "model": self.ollama_model,
            "messages": [{"role": "system", "content": prompt}],
            "format": "json", # Fuerza respuesta JSON estructurada
            "stream": False,
            "options": {"temperature": 0.2}
        }
        
        print(f"[LLM/Ollama] 📤 Request to {url}")
        print(f"[LLM/Ollama] Model: {self.ollama_model}")
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    raise Exception(f"Ollama Error {resp.status}: {text}")
                
                data = await resp.json()
                content = data.get("message", {}).get("content", "")
                
                print(f"[LLM/Ollama] 📥 Response received ({len(content)} chars)")
                print(f"[LLM/Ollama] Raw Output: {content[:200]}...")
                
                return self._parse_json(content)

    async def _call_groq(self, prompt: str) -> List[Dict[str, str]]:
        """Llamada a Groq API como fallback."""
        client = self._get_groq_client()
        if not client:
            raise Exception("Groq client not available (check API KEY or install groq package).")
        
        print(f"[LLM/Groq] 📤 Sending request to Groq API")
        print(f"[LLM/Groq] Model: llama3-8b-8192")
        
        # Groq no tiene modo JSON nativo estricto como Ollama en todas las libs,
        # pero Llama3 suele obedecer si se le pide JSON.
        completion = await asyncio.to_thread(
            lambda: client.chat.completions.create(
                messages=[{"role": "system", "content": prompt + " RETURN ONLY JSON."}],
                model="llama3-8b-8192", # Modelo rápido
                temperature=0.7,
            )
        )
        content = completion.choices[0].message.content
        
        print(f"[LLM/Groq] 📥 Response received ({len(content)} chars)")
        print(f"[LLM/Groq] Raw Output: {content[:200]}...")
        
        return self._parse_json(content)

    def _parse_json(self, text: str) -> List[Dict[str, str]]:
        """Intenta extraer y parsear JSON de la respuesta."""
        try:
            # Limpieza básica por si el modelo incluye markdown ```json ... ```
            clean = text.strip()
            if clean.startswith("```json"):
                clean = clean.split("```json")[1]
            if clean.endswith("```"):
                clean = clean.split("```")[0]
            
            data = json.loads(clean)
            
            # Normalizar respuesta (puede ser dict con key 'scenarios' o lista directa)
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                # Buscar alguna lista dentro del dict
                for key, val in data.items():
                    if isinstance(val, list):
                        return val
            return []
        except json.JSONDecodeError:
            print(f"[LLM] Failed to parse JSON: {text[:100]}...")
            return []
