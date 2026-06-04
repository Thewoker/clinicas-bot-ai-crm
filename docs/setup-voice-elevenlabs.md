# Setup Voice AI (ElevenLabs) — Guía paso a paso

## Requisitos previos

- Cuenta de ElevenLabs con plan activo (mínimo Starter $6/mes)
- Cuenta de Telnyx con un número de teléfono comprado
- Variable de entorno `ELEVENLABS_API_KEY` configurada en Railway

---

## Paso 1 — API Key de ElevenLabs

1. Entrá a [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys)
2. Creá una nueva API key con estos permisos:
   - **ElevenAgents** → Escribir
   - **Voces** → Leído
3. Copiá la key y agregala como variable de entorno `ELEVENLABS_API_KEY` en Railway

---

## Paso 2 — Crear SIP Connection en Telnyx

1. Entrá a [portal.telnyx.com](https://portal.telnyx.com) → **Voice Suite → SIP Trunking** → **Create SIP Connection**
2. **Step 1 — Details**
   - Nombre: `ElevenLabs Voice AI` (o el que prefieras)
   - Tipo: **FQDN**
   - Clic en **Create**

3. **Step 2 — Authentication and Routing**
   - En **FQDNs** → clic en **+ Add FQDN**
     - FQDN: `sip.rtc.elevenlabs.io`
     - Port: `5060`
     - DNS Record Type: `A`
   - En **Primary FQDN** → seleccioná `sip.rtc.elevenlabs.io`
   - En **Outbound calls authentication** → método **Credentials**
     - Username: inventá uno (ej: `clinica-bot`)
     - Password: inventá una contraseña segura
     - **⚠️ Anotá estos datos — los necesitás en el Paso 3**

4. **Step 3 — Configuration** → dejá los valores por defecto

5. **Step 4 — Inbound**
   - Destination Number Format: `+E.164`
   - SIP Transport Protocol: `TCP`

6. **Step 5 — Outbound** → asigná o creá un Outbound Voice Profile

7. **Step 6 — Numbers** → asigná el número de teléfono de la clínica a esta conexión

---

## Paso 3 — Importar número en ElevenLabs

1. Entrá a [elevenlabs.io/app/conversational-ai/phone-numbers](https://elevenlabs.io/app/conversational-ai/phone-numbers)
2. Clic en **Import a phone number from SIP trunk**
3. Completá los campos:
   - **Label**: nombre de la clínica (ej: `Clínica San Rafael`)
   - **Phone Number**: número en E.164 (ej: `+34886020247`)
   - **Transport**: `TCP`
   - **Address**: `sip.telnyx.com`
   - **SIP Trunk Username**: el usuario del Paso 2
   - **SIP Trunk Password**: la contraseña del Paso 2
4. Clic en **Import**

5. **Deshabilitar autenticación de entrada** (importante para que Telnyx pueda enrutar llamadas):
   - Hacé clic en el número recién importado → **Editar**
   - En **Configuración de entrada → Autenticación (Opcional)**
   - **Borrá el usuario y dejá la contraseña vacía**
   - Guardá

---

## Paso 4 — Obtener el Phone Number ID

Hacé esta llamada a la API de ElevenLabs (reemplazá `TU_API_KEY`):

```
GET https://api.elevenlabs.io/v1/convai/phone-numbers
Headers: xi-api-key: TU_API_KEY
```

En la respuesta, buscá el objeto con tu número y copiá el valor de `phone_number_id`.

```json
{
  "phone_number": "+34886020247",
  "phone_number_id": "phnum_XXXXXXXXXXXXXXXXXX"
}
```

---

## Paso 5 — Configurar en el CRM

1. Accedé al panel admin: `/admin/voice`
2. Encontrá la clínica correspondiente
3. Pegá el **Phone Number ID** en el campo correspondiente
4. Clic en **Crear agente** → el sistema crea el agente en ElevenLabs automáticamente

---

## Paso 6 — Verificar

**Llamada saliente (bot llama al cliente):**
- En `/admin/voice`, ingresá un número de teléfono y clic en **Llamar**
- El teléfono debería sonar y el bot saludar

**Llamada entrante (cliente llama al bot):**
- Llamá directamente al número de la clínica
- ElevenLabs debería contestar con el saludo configurado

---

## Desvinculación

Para reasignar un número a otra clínica:
1. En `/admin/voice` → clínica actual → **Desvincular agente y número**
2. Confirmá la desvinculación
3. Repetí el Paso 5 para la nueva clínica

---

## Variables de entorno necesarias (Railway)

| Variable | Descripción |
|----------|-------------|
| `ELEVENLABS_API_KEY` | API key de ElevenLabs |
| `NEXT_PUBLIC_APP_URL` | URL de producción (ej: `clinicas-bot-ai-crm-production.up.railway.app`) |
| `ANTHROPIC_API_KEY` | API key de Claude (para el bot) |
| `GROQ_API_KEY` | API key de Groq (para transcripción WhatsApp) |
