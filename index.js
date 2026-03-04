import TelegramBot from 'node-telegram-bot-api';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get, set, update, push, remove } from 'firebase/database';

// --- 1. CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyBCk_6-UQu_8js-Rof_Vps7QWPBw6dJFcg",
  authDomain: "temo-store.firebaseapp.com",
  databaseURL: "https://temo-store-default-rtdb.firebaseio.com", 
  projectId: "temo-store",
  storageBucket: "temo-store.firebasestorage.app",
  messagingSenderId: "502364316401",
  appId: "1:502364316401:web:201b9e9c6e426acdb33f50"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --- 2. CONFIGURACIÓN DEL BOT ---
const token = '8240591970:AAEAPtTNdanUdR0tXZDjFC9hcdxsdmQFuGI'; // ¡Pon tu Token aquí!
const bot = new TelegramBot(token, { polling: true });

const admins = [8182510987, 7710633235, 5706003078];
const WHATSAPP_URL = "https://wa.me/523224528803";
const userStates = {};

// --- 3. COMANDO /START ---
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.first_name || "Usuario";

  const userRef = ref(db, `users/${chatId}`);
  const snapshot = await get(userRef);
  if (!snapshot.exists()) {
    await set(userRef, { nombre: username, saldo: 0, keys_compradas: [] });
  }

  if (admins.includes(chatId)) {
    bot.sendMessage(chatId, `👑 *Panel de Administrador* | Hola ${username}`, {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "➕ Agregar Saldo" }, { text: "➖ Quitar Saldo" }],
          [{ text: "📦 Crear Producto" }, { text: "📋 Gestionar Productos" }]
        ],
        resize_keyboard: true, 
        is_persistent: true    
      }
    });
  } else {
    bot.sendMessage(chatId, `👋 Hola ${username}, ¡Bienvenido a *TEMO STORE*!\n\nUsa el menú de abajo para navegar:`, {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          [{ text: "🛒 Ver Productos" }],
          [{ text: "👤 Mi Perfil" }, { text: "💳 Recargar Saldo" }]
        ],
        resize_keyboard: true,
        is_persistent: true
      }
    });
  }
});

// --- 4. MANEJO DE TEXTOS DEL TECLADO Y ESTADOS ---
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const isAdmin = admins.includes(chatId);

  if (!text) return;

  if (text === "👤 Mi Perfil") {
    const userData = (await get(ref(db, `users/${chatId}`))).val() || { saldo: 0 };
    let texto = `👤 *Tu Perfil*\n\n💰 Saldo: $${userData.saldo}\n🆔 Tu ID: \`${chatId}\`\n\n🔑 *Tus Keys Compradas:*\n`;
    
    let keysArr = userData.keys_compradas || [];
    if (!Array.isArray(keysArr)) keysArr = Object.values(keysArr);

    if (keysArr.length > 0) {
      keysArr.forEach(k => texto += `- \`${k}\`\n`);
    } else {
      texto += "Aún no tienes keys.";
    }
    return bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });
  }

  if (text === "💳 Recargar Saldo") {
    return bot.sendMessage(chatId, `Para recargar saldo, por favor comunícate a nuestro WhatsApp tocando el siguiente enlace:\n\n👉 [Contactar por WhatsApp](${WHATSAPP_URL})`, { parse_mode: "Markdown" });
  }

  if (text === "🛒 Ver Productos" && !isAdmin) { 
    const prodsSnap = await get(ref(db, 'productos'));
    if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos disponibles.");
    
    const botones = [];
    prodsSnap.forEach((child) => {
      const nombre = child.val().nombre || "Producto";
      botones.push([{ text: `🎮 ${nombre}`, callback_data: `buy_prod:${child.key}` }]);
    });
    return bot.sendMessage(chatId, "Selecciona un producto para ver sus precios:", {
      reply_markup: { inline_keyboard: botones }
    });
  }

  if (isAdmin) {
    if (text === "➕ Agregar Saldo") {
      userStates[chatId] = { step: 'AWAITING_USER_ID' };
      return bot.sendMessage(chatId, "Envía el **ID del usuario** para recargarle saldo:", { parse_mode: "Markdown" });
    }

    if (text === "➖ Quitar Saldo") {
      const usersSnap = await get(ref(db, 'users'));
      if (!usersSnap.exists()) return bot.sendMessage(chatId, "No hay usuarios registrados en la base de datos.");

      let lista = "👥 *Usuarios con saldo disponible:*\n\n";
      let hayUsuariosConSaldo = false;

      usersSnap.forEach((child) => {
        const user = child.val();
        if (user.saldo > 0) {
          lista += `👤 *${user.nombre}*\n🆔 ID: \`${child.key}\`\n💰 Saldo: $${user.saldo}\n\n`;
          hayUsuariosConSaldo = true;
        }
      });

      if (!hayUsuariosConSaldo) {
        return bot.sendMessage(chatId, "❌ En este momento no hay ningún usuario que tenga saldo en su cuenta.");
      }

      lista += "Para quitar saldo, copia y envía el **ID del usuario** de la lista de arriba:";
      userStates[chatId] = { step: 'AWAITING_REMOVE_USER_ID' };
      return bot.sendMessage(chatId, lista, { parse_mode: "Markdown" });
    }
    
    if (text === "📦 Crear Producto") {
      userStates[chatId] = { step: 'AWAITING_PROD_NAME' };
      return bot.sendMessage(chatId, "Escribe el **Nombre del nuevo producto** (Ej: Free Fire Mod):", { parse_mode: "Markdown" });
    }
    
    if (text === "📋 Gestionar Productos") {
      const prodsSnap = await get(ref(db, 'productos'));
      if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos.");
      
      const botones = [];
      prodsSnap.forEach((child) => {
        const nombre = child.val().nombre || "Producto";
        botones.push([{ text: `Editar/Eliminar ${nombre}`, callback_data: `edit_prod:${child.key}` }]);
      });
      return bot.sendMessage(chatId, "Selecciona un producto:", { reply_markup: { inline_keyboard: botones } });
    }
  }

  // --- LÓGICA DE ESTADOS ---
  const state = userStates[chatId];
  if (!state || text.startsWith('/')) return;

  const currentState = { ...state };
  delete userStates[chatId];

  if (currentState.step === 'AWAITING_USER_ID') {
    const targetUserId = text.trim();
    const userSnapshot = await get(ref(db, `users/${targetUserId}`));
    if (userSnapshot.exists()) {
      userStates[chatId] = { step: 'AWAITING_AMOUNT', targetUserId }; 
      const nombreUsuario = userSnapshot.val().nombre || "Usuario";
      bot.sendMessage(chatId, `Usuario: ${nombreUsuario}. ¿Cuánto saldo agregas? (Escribe el número)`);
    } else {
      bot.sendMessage(chatId, "❌ Usuario no encontrado.");
    }
  } 
  else if (currentState.step === 'AWAITING_AMOUNT') {
    const amount = parseFloat(text.trim());
    if (isNaN(amount)) {
      userStates[chatId] = currentState; 
      return bot.sendMessage(chatId, "❌ Escribe un número válido.");
    }

    const targetRef = ref(db, `users/${currentState.targetUserId}/saldo`);
    const currentBalance = (await get(targetRef)).val() || 0;
    await set(targetRef, currentBalance + amount);
    bot.sendMessage(chatId, `✅ Saldo actualizado. Nuevo saldo: $${currentBalance + amount}`);
    bot.sendMessage(currentState.targetUserId, `🎉 ¡Te han recargado $${amount} de saldo!`);
  }

  else if (currentState.step === 'AWAITING_REMOVE_USER_ID') {
    const targetUserId = text.trim();
    const userSnapshot = await get(ref(db, `users/${targetUserId}`));
    
    if (userSnapshot.exists()) {
      const userData = userSnapshot.val();
      if (userData.saldo <= 0) {
        return bot.sendMessage(chatId, "❌ Este usuario ya tiene $0 de saldo.");
      }
      userStates[chatId] = { step: 'AWAITING_REMOVE_AMOUNT', targetUserId }; 
      bot.sendMessage(chatId, `Usuario: ${userData.nombre || "Usuario"} (Saldo actual: $${userData.saldo}).\n¿Cuánto saldo le deseas quitar? (Escribe solo el número)`);
    } else {
      bot.sendMessage(chatId, "❌ Usuario no encontrado. Intenta de nuevo presionando '➖ Quitar Saldo'.");
    }
  }
  else if (currentState.step === 'AWAITING_REMOVE_AMOUNT') {
    const amount = parseFloat(text.trim());
    if (isNaN(amount) || amount <= 0) {
      userStates[chatId] = currentState; 
      return bot.sendMessage(chatId, "❌ Escribe un número válido mayor a 0.");
    }

    const targetRef = ref(db, `users/${currentState.targetUserId}/saldo`);
    const currentBalance = (await get(targetRef)).val() || 0;

    let nuevoSaldo = currentBalance - amount;
    if (nuevoSaldo < 0) nuevoSaldo = 0;

    await set(targetRef, nuevoSaldo);
    bot.sendMessage(chatId, `✅ Saldo descontado correctamente. Nuevo saldo del usuario: $${nuevoSaldo}`);
    bot.sendMessage(currentState.targetUserId, `⚠️ Se han descontado $${amount} de tu saldo. Tu saldo actual es de: $${nuevoSaldo}`);
  }

  else if (currentState.step === 'AWAITING_PROD_NAME') {
    const newProdRef = push(ref(db, 'productos'));
    await set(newProdRef, { nombre: text.trim() });
    bot.sendMessage(chatId, `✅ Producto "${text}" creado.\nVe a "Gestionar Productos" para administrarlo.`);
  }
  else if (currentState.step === 'AWAITING_OPT_NAME') {
    const match = text.match(/(.+?)\s+(\d+)\$$/); 
    if (!match) {
      userStates[chatId] = currentState; 
      return bot.sendMessage(chatId, "⚠️ Formato incorrecto. Ejemplo: '1 dia 3$'. Intenta de nuevo.");
    }

    const titulo = match[1].trim(); 
    const precio = parseInt(match[2]); 
    const newOptRef = push(ref(db, `productos/${currentState.prodId}/opciones`));
    await set(newOptRef, { titulo: titulo, precio: precio, keys: [] });
    
    bot.sendMessage(chatId, `✅ Opción agregada: ${titulo} por $${precio}.\n¿Quieres agregarle keys ahora?`, {
      reply_markup: { inline_keyboard: [[{ text: "➕ Agregar Keys", callback_data: `add_keys:${currentState.prodId}:${newOptRef.key}` }]] }
    });
  }
  else if (currentState.step === 'AWAITING_KEYS') {
    const keysArray = text.split('\n').map(k => k.trim()).filter(k => k !== '');
    const keysRef = ref(db, `productos/${currentState.prodId}/opciones/${currentState.optId}/keys`);
    
    const currentKeysSnap = await get(keysRef);
    let currentKeys = currentKeysSnap.val() || [];
    if (!Array.isArray(currentKeys)) currentKeys = Object.values(currentKeys);
    
    currentKeys = currentKeys.concat(keysArray);
    
    await set(keysRef, currentKeys);
    bot.sendMessage(chatId, `✅ Se agregaron ${keysArray.length} keys exitosamente a esta opción.`);
  }
});

// --- 5. MANEJO DE BOTONES EN LÍNEA ---
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const isAdmin = admins.includes(chatId);

  const responder = () => bot.answerCallbackQuery(query.id).catch(()=>{});

  if (data.startsWith('buy_prod:')) {
    const prodId = data.split(':')[1];
    const prodSnap = await get(ref(db, `productos/${prodId}`));
    
    if (!prodSnap.exists()) {
      bot.sendMessage(chatId, "Producto no encontrado.");
      return responder();
    }
    const producto = prodSnap.val();
    
    if (!producto.opciones) {
      bot.sendMessage(chatId, "Este producto no tiene duraciones/precios aún.");
      return responder();
    }

    const botones = [];
    for (const optId in producto.opciones) {
      const opt = producto.opciones[optId];
      const titulo = opt.titulo || "Opción";
      const precio = opt.precio || 0;
      botones.push([{ text: `${titulo} - $${precio}`, callback_data: `checkout:${prodId}:${optId}` }]);
    }
    
    const prodNombre = producto.nombre || "Producto";
    bot.sendMessage(chatId, `🛒 *${prodNombre}*\nElige la duración que deseas comprar:`, {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: botones }
    });
    return responder();
  }

  if (data.startsWith('checkout:')) {
    const partes = data.split(':');
    const prodId = partes[1];
    const optId = partes[2];
    
    const [userSnap, optSnap, prodNameSnap] = await Promise.all([
      get(ref(db, `users/${chatId}`)),
      get(ref(db, `productos/${prodId}/opciones/${optId}`)),
      get(ref(db, `productos/${prodId}/nombre`))
    ]);

    const user = userSnap.val() || { saldo: 0 };
    const opt = optSnap.val() || {};
    const prodNombre = prodNameSnap.exists() ? prodNameSnap.val() : "Producto";

    let keysDisponibles = opt.keys || [];
    if (!Array.isArray(keysDisponibles)) keysDisponibles = Object.values(keysDisponibles);

    if (keysDisponibles.length === 0) {
      bot.sendMessage(chatId, "❌ Lo siento, no hay keys disponibles para esta opción en este momento.");
      return responder();
    }

    const precio = opt.precio || 0;
    if (user.saldo < precio) {
      bot.sendMessage(chatId, `❌ *Saldo insuficiente.*\nTu saldo: $${user.saldo}\nPrecio: $${precio}\n\nPor favor recarga saldo para continuar.`, {
        parse_mode: "Markdown"
      });
      return responder();
    }

    const keyEntregada = keysDisponibles[0];
    const nuevasKeysProd = keysDisponibles.slice(1);
    const nuevoSaldo = user.saldo - precio; 
    
    let nuevasKeysUser = user.keys_compradas || [];
    if (!Array.isArray(nuevasKeysUser)) nuevasKeysUser = Object.values(nuevasKeysUser);
    nuevasKeysUser.push(keyEntregada);

    await update(ref(db), {
      [`users/${chatId}/saldo`]: nuevoSaldo,
      [`users/${chatId}/keys_compradas`]: nuevasKeysUser,
      [`productos/${prodId}/opciones/${optId}/keys`]: nuevasKeysProd
    });

    const tituloOpt = opt.titulo || "Opción";
    bot.sendMessage(chatId, `✅ *¡COMPRA EXITOSA!*\n\nCompraste: *${tituloOpt}*\nAquí está tu Key:\n\n\`${keyEntregada}\`\n\n💰 Tu nuevo saldo es: $${nuevoSaldo}`, { parse_mode: "Markdown" });
    
    if (nuevasKeysProd.length === 0) {
      admins.forEach((adminId) => {
        bot.sendMessage(
          adminId, 
          `⚠️ *ALERTA DE INVENTARIO*\n\nSe han agotado las keys.\n\n📦 *Producto:* ${prodNombre}\n⏱ *Duración:* ${tituloOpt}\n\nPor favor recarga más keys para seguir vendiendo.`, 
          { parse_mode: "Markdown" }
        ).catch(() => {});
      });
    }

    return responder();
  }

  // --- FUNCIONES DEL ADMIN EN LÍNEA ---
  if (isAdmin) {
    if (data.startsWith('edit_prod:')) {
      const prodId = data.split(':')[1];
      const prodSnap = await get(ref(db, `productos/${prodId}/nombre`));
      const nombreProd = prodSnap.exists() ? prodSnap.val() : "este producto";

      bot.sendMessage(chatId, `⚙️ *Opciones para: ${nombreProd}*\n¿Qué deseas hacer?`, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Agregar Duración/Precio", callback_data: `add_opt:${prodId}` }],
            // --- NUEVO BOTÓN AQUÍ ---
            [{ text: "🔑 Agregar Keys a Duración", callback_data: `choose_opt_keys:${prodId}` }],
            [{ text: "🗑️ Eliminar Producto", callback_data: `del_prod:${prodId}` }]
          ]
        }
      });
    }

    // --- NUEVA LÓGICA PARA ELEGIR A QUÉ DURACIÓN METERLE KEYS ---
    if (data.startsWith('choose_opt_keys:')) {
      const prodId = data.split(':')[1];
      const prodSnap = await get(ref(db, `productos/${prodId}`));
      
      if (!prodSnap.exists() || !prodSnap.val().opciones) {
         bot.sendMessage(chatId, "⚠️ Este producto no tiene duraciones/precios creados todavía. Usa 'Agregar Duración/Precio' primero.");
         return responder();
      }

      const opciones = prodSnap.val().opciones;
      const botones = [];
      
      for (const optId in opciones) {
        const opt = opciones[optId];
        const titulo = opt.titulo || "Opción";
        const precio = opt.precio || 0;
        // Reusamos el callback `add_keys` que ya estaba programado
        botones.push([{ text: `🔑 ${titulo} - $${precio}`, callback_data: `add_keys:${prodId}:${optId}` }]);
      }

      bot.sendMessage(chatId, "Selecciona a qué duración le quieres agregar las keys:", {
        reply_markup: { inline_keyboard: botones }
      });
    }

    if (data.startsWith('del_prod:')) {
      const prodId = data.split(':')[1];
      await remove(ref(db, `productos/${prodId}`));
      bot.sendMessage(chatId, "🗑️ ✅ Producto eliminado exitosamente de la base de datos.");
    }

    if (data.startsWith('add_opt:')) {
      const prodId = data.split(':')[1];
      userStates[chatId] = { step: 'AWAITING_OPT_NAME', prodId: prodId };
      bot.sendMessage(chatId, "Escribe el **título y precio** separados por un espacio terminando con $.\nEjemplo: `1 dia 3$`", { parse_mode: "Markdown" });
    }

    if (data.startsWith('add_keys:')) {
      const partes = data.split(':');
      userStates[chatId] = { step: 'AWAITING_KEYS', prodId: partes[1], optId: partes[2] };
      bot.sendMessage(chatId, "Envía las **Keys** una debajo de otra (cada línea será una key separada):", { parse_mode: "Markdown" });
    }
  }

  responder();
});

console.log("Bot de TEMO STORE iniciado (Menú principal como teclado)...");
