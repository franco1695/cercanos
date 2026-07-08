# Cercanos — app de citas para Lima

Backend + frontend completos en un solo proyecto Node.js, listos para subir a un hosting.

## Qué incluye

- Registro e inicio de sesión con contraseña (hash seguro con bcrypt + sesión con JWT).
- **Inicio de sesión con Facebook** (opcional, requiere que configures tu propia app de Facebook — ver sección 3).
- Validación de edad mínima (18+).
- Perfiles con foto, bio, distrito de Lima y género (con preferencia de a quién quieres ver, como en Tinder).
- **Explorar con swipe**: desliza las tarjetas o usa los botones ✕ / ❤ para pasar entre perfiles, estilo Tinder.
- Chat libre entre cualquier par de usuarios (sin necesidad de "match").
- **Videollamadas gratis** (WebRTC + Socket.IO, sin ningún servicio de pago) — se desbloquean automáticamente cuando ambas personas ya se escribieron al menos 3 mensajes cada una en esa conversación.
- Reportar usuarios (si un usuario acumula reportes de 3 personas distintas, se suspende automáticamente).
- Bloquear/desbloquear usuarios (deja de verse y de poder escribirse en ambos sentidos).
- Base de datos en un archivo `data.json` (sin dependencias nativas, funciona en cualquier hosting).

## 1. Probarlo en tu computadora (opcional pero recomendado)

Necesitas tener [Node.js](https://nodejs.org) instalado (versión 18 o superior).

```bash
cd cercanos-app
npm install
cp .env.example .env
```

Abre el archivo `.env` y reemplaza `JWT_SECRET` por un valor único (puedes generarlo con):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Luego corre:

```bash
npm start
```

Abre `http://localhost:3000` en tu navegador.

## 2. Subirlo a un hosting (recomendado: Render.com)

Render tiene un plan gratuito y es de los más simples para este tipo de proyecto.

### Paso a paso:

1. **Sube este proyecto a GitHub**
   - Crea un repositorio nuevo (puede ser privado).
   - Sube todos estos archivos (excepto `node_modules`, que Render instala solo).

2. **Crea una cuenta en [render.com](https://render.com)**

3. **Crea un nuevo "Web Service"**
   - Conecta tu repositorio de GitHub.
   - Render detectará que es un proyecto Node.js.
   - Build Command: `npm install`
   - Start Command: `npm start`

4. **Configura la variable de entorno**
   - En la sección "Environment", agrega:
     - `JWT_SECRET` = (un valor secreto largo y aleatorio, el mismo tipo que generaste arriba)
   - No hace falta configurar `PORT`, Render lo asigna automáticamente.

5. **Importante: agrega un disco persistente**
   - Este proyecto guarda los datos en un archivo (`data.json`) y las fotos en la carpeta `uploads/`.
   - Sin esto, **los datos se borrarían cada vez que el servidor se reinicia**.
   - En Render: ve a la pestaña "Disks" de tu servicio → "Add Disk" → móntalo en la ruta `/opt/render/project/src` (o la ruta raíz de tu proyecto) con al menos 1GB.

6. **Deploy**
   - Dale a "Create Web Service". Render instalará todo y en unos minutos te dará una URL pública como `https://cercanos.onrender.com`.

### Alternativas a Render
- **Railway.app**: proceso muy similar, también con disco persistente.
- **Un VPS propio** (DigitalOcean, Hostinger VPS, etc.): más control, pero requiere configurar tú mismo Node.js, un proceso en segundo plano (con `pm2`) y un dominio con HTTPS (por ejemplo con Certbot/Let's Encrypt).

## 3. Configurar "Continuar con Facebook"

El login con Facebook ya está integrado en el código, pero necesita que tú crees tu propia app en Facebook (es gratis) y me des dos datos.

1. Ve a **[developers.facebook.com](https://developers.facebook.com/)** e inicia sesión con tu cuenta de Facebook.
2. Click en **"Mis apps"** → **"Crear app"**.
3. Elige el tipo **"Consumidor"** (o "Otro" si no aparece esa opción) y dale un nombre, por ejemplo "Cercanos".
4. Dentro del panel de tu app, busca el producto **"Facebook Login"** (Inicio de sesión con Facebook) y agrégalo.
5. En la configuración de "Facebook Login" → **"Configuración"**, agrega en **"URI de redireccionamiento de OAuth válidos"**:
   ```
   https://TU-DOMINIO-DE-RENDER.onrender.com/api/auth/facebook/callback
   ```
   (reemplaza con la URL real que te dio Render, o tu dominio propio si ya lo conectaste).
6. Ve a **Configuración → Básica** y copia el **"ID de la aplicación"** y el **"Secreto de la aplicación"**.
7. En Render, agrega dos variables de entorno nuevas:
   - `FACEBOOK_APP_ID` = el ID que copiaste
   - `FACEBOOK_APP_SECRET` = el secreto que copiaste
8. Vuelve a desplegar (Render lo hace solo al guardar las variables).

Los permisos que usa la app (`public_profile` y `email`) **no requieren revisión de Facebook** y funcionan automáticamente para cualquier usuario desde el primer momento — no necesitas pasar por el proceso de "App Review" para esto.

**Nota:** mientras tu app de Facebook esté en modo "Desarrollo" (el estado por defecto), **solo tú y las personas que agregues como "Testers" o administradores** en el panel de Facebook podrán usar el login con Facebook. Para que cualquier persona pueda usarlo, debes cambiar el estado de la app a **"Activo/Live"** desde el panel principal de tu app en Facebook (esto no requiere revisión para estos dos permisos básicos, pero sí te pedirá completar datos como Política de Privacidad y categoría de la app).

## 4. Sobre las videollamadas (importante, y por qué son gratis)

Las llamadas usan **WebRTC**: la tecnología que hace que el navegador de dos personas se conecte de forma directa (audio y video viajan entre ellos, no pasan por tu servidor). Solo usamos el servidor para "presentarlos" (esto se llama señalización), lo cual no tiene costo.

- Se desbloquean automáticamente cuando ambas personas ya se escribieron **al menos 3 mensajes cada una** en esa conversación.
- Ambas personas deben estar con la app abierta al mismo tiempo para que la llamada entre (no es como una llamada telefónica que suena si tienes la app cerrada).
- Usamos un servidor STUN público y gratuito de Google para ayudar a conectar a ambas personas. Esto funciona bien en la gran mayoría de redes hogareñas y de celular.
- **Limitación a tener en cuenta**: en redes muy restrictivas (algunas redes corporativas, universitarias, o con configuraciones especiales de router), la conexión directa puede fallar. La solución completa a esto es un "servidor TURN", que sí normalmente tiene un costo pequeño (aunque existen opciones gratuitas limitadas, como el plan gratuito de Twilio o metered.ca, por si más adelante quieres una tasa de éxito de conexión más alta). Por ahora, dejamos la versión 100% gratuita.
- **Si usas el plan Free de Render**: el servicio "se duerme" tras ~15 minutos sin visitas, y despertarlo toma unos segundos. Mientras está dormido, nadie puede recibir llamadas (ni mensajes en tiempo real). En cuanto alguien abre la app, el servidor despierta solo.

## 5. Conectar tu propio dominio

Una vez desplegado, la mayoría de hostings (Render incluido) te permiten agregar un dominio propio desde su panel, apuntando los DNS de tu dominio (comprado en NameCheap, GoDaddy, etc.) hacia la URL que te dieron.

## Antes de lanzarlo públicamente, ten en cuenta

Este proyecto ya es funcional y bastante más sólido que un prototipo, pero para manejar datos reales de personas (fotos, mensajes privados, ubicación) con tranquilidad legal y de seguridad, conviene sumar:

- **Política de privacidad y Términos de Uso** (obligatorio en Perú por la Ley de Protección de Datos Personales, Ley N.º 29733, al tratarse de datos personales y fotos).
- **Revisión manual de reportes**: ahora mismo un usuario se banea automáticamente al recibir reportes de 3 personas distintas; sería bueno tener un panel de administración para revisar caso por caso.
- **Verificación de foto/identidad**, si quieres reducir perfiles falsos.
- **Backups automáticos** del archivo `data.json` y de la carpeta `uploads/` (para no perder información si el disco falla).
- **Migrar a una base de datos más robusta** (PostgreSQL, por ejemplo) si el número de usuarios crece mucho, ya que el archivo JSON es simple y funciona bien para cientos/pocos miles de usuarios, pero no está pensado para gran escala.

## Estructura del proyecto

```
cercanos-app/
├── server.js           → servidor principal (Express)
├── db.js               → base de datos (archivo JSON)
├── middleware/auth.js  → verificación de sesión (JWT)
├── routes/
│   ├── auth.js          → registro / login
│   ├── profiles.js      → perfiles y fotos
│   ├── chat.js          → mensajes
│   └── reports.js       → reportes y bloqueos
├── public/index.html   → todo el frontend (una sola página)
├── uploads/             → fotos de perfil subidas por los usuarios
├── .env.example         → variables de entorno necesarias
└── package.json
```
