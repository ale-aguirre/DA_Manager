import asyncio
import os
from dotenv import load_dotenv
from services.llm import LLMService

# Cargar env para pruebas
load_dotenv()

async def main():
    print("--- Probando Servicio LLM ---")
    service = LLMService()
    print(f"Provider: {service.provider}")
    print(f"Model: {service.ollama_model}")
    
    char = "Hatsune Miku"
    print(f"\nGenerando 3 escenarios para: {char}...")
    
    try:
        scenarios = await service.generate_scenarios(char, 3)
        print("\nResultado:")
        print(scenarios)
        
        if scenarios and isinstance(scenarios, list) and len(scenarios) > 0:
            print("\n✅ TEST PASS: Se recibió una lista de escenarios.")
            print(f"Ejemplo 1 Outfit: {scenarios[0].get('outfit')}")
        else:
            print("\n❌ TEST FAIL: Lista vacía o formato incorrecto.")
            
    except Exception as e:
        print(f"\n❌ ERROR CRÍTICO: {e}")

if __name__ == "__main__":
    asyncio.run(main())
