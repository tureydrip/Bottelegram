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

// Estos son los únicos que pueden agregar/quitar otros admins
const PRINCIPAL_ADMINS = [8182510987, 7710633235,];
const WHATSAPP_URL = "https://wa.me/523224528803";
const userStates = {};

// Función auxiliar para verificar permisos
async function checkAdminPermissions(chatId) {
  const isPrincipal = PRINCIPAL_ADMINS.includes(chatId);
  const subAdminsSnap = await get(ref(db, 'sub_admins'));
  const subAdmins = subAdminsSnap.exists() ? subAdminsSnap.val() : {};
  const isSubAdmin = subAdmins.hasOwnProperty(chatId.toString());
  
  const isAdmin = isPrincipal || isSubAdmin;
  const permisos = isSubAdmin ? (subAdmins[chatId.toString()].permisos || {}) : {};

  const hasPermission = (perm) => {
    if (isPrincipal) return true;
    if (isSubAdmin && permisos[perm] === true) return true;
    return false;
  };

  return { isPrincipal, isSubAdmin, isAdmin, hasPermission };
}

// --- 3. COMANDO /START ---
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const username = msg.from.first_name || "Usuario";

  const userRef = ref(db, `users/${chatId}`);
  const snapshot = await get(userRef);
  if (!snapshot.exists()) {
    await set(userRef, { nombre: username, saldo: 0, keys_compradas: [] });
  }

  const { isAdmin, isPrincipal, hasPermission } = await checkAdminPermissions(chatId);

  if (isAdmin) {
    // Construimos el teclado dinámicamente según los permisos que tenga
    const keyboard = [];
    const row1 = [];
    if (hasPermission('add_saldo')) row1.push({ text: "➕ Agregar Saldo" });
    if (hasPermission('remove_saldo')) row1.push({ text: "➖ Quitar Saldo" });
    if (row1.length > 0) keyboard.push(row1);

    const row2 = [];
    if (hasPermission('create_prod')) row2.push({ text: "📦 Crear Producto" });
    if (hasPermission('manage_prod')) row2.push({ text: "📋 Gestionar Productos" });
    if (row2.length > 0) keyboard.push(row2);

    const row3 = [];
    if (hasPermission('view_stock')) row3.push({ text: "📊 Ver Stocks" });
    if (hasPermission('edit_price')) row3.push({ text: "✏️ Editar Precios" });
    if (row3.length > 0) keyboard.push(row3);

    // Solo los principales ven el gestor de admins
    if (isPrincipal) {
      keyboard.push([{ text: "👥 Gestionar Admins" }]);
    }

    bot.sendMessage(chatId, `👑 *Panel de Administrador* | Hola ${username}`, {
      parse_mode: "Markdown",
      reply_markup: { keyboard: keyboard, resize_keyboard: true, is_persistent: true }
    });
  } else {
    bot.sendMessage(chatId, `👋 Hola ${username}, ¡Bienvenido a *TEMO STORE*!\n\nUsa el menú de abajo para navegar:`, {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [[{ text: "🛒 Ver Productos" }], [{ text: "👤 Mi Perfil" }, { text: "💳 Recargar Saldo" }]],
        resize_keyboard: true, is_persistent: true
      }
    });
  }
});

// --- 4. MANEJO DE TEXTOS DEL TECLADO Y ESTADOS ---
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  const { isAdmin, isPrincipal, hasPermission } = await checkAdminPermissions(chatId);

  // --- ZONA DE USUARIOS NORMALES ---
  if (text === "👤 Mi Perfil") {
    const userData = (await get(ref(db, `users/${chatId}`))).val() || { saldo: 0 };
    let texto = `👤 *Tu Perfil*\n\n💰 Saldo: $${userData.saldo}\n🆔 Tu ID: \`${chatId}\`\n\n🔑 *Tus Keys Compradas:*\n`;
    let keysArr = userData.keys_compradas || [];
    if (!Array.isArray(keysArr)) keysArr = Object.values(keysArr);

    if (keysArr.length > 0) keysArr.forEach(k => texto += `- \`${k}\`\n`);
    else texto += "Aún no tienes keys.";
    
    return bot.sendMessage(chatId, texto, { parse_mode: "Markdown" });
  }

  if (text === "💳 Recargar Saldo") {
    return bot.sendMessage(chatId, `Para recargar saldo, comunícate a nuestro WhatsApp:\n👉 [Contactar por WhatsApp](${WHATSAPP_URL})`, { parse_mode: "Markdown" });
  }

  if (text === "🛒 Ver Productos" && !isAdmin) { 
    const prodsSnap = await get(ref(db, 'productos'));
    if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos disponibles.");
    
    const botones = [];
    prodsSnap.forEach((child) => botones.push([{ text: `🎮 ${child.val().nombre || "Producto"}`, callback_data: `buy_prod:${child.key}` }]));
    return bot.sendMessage(chatId, "Selecciona un producto para ver sus precios:", { reply_markup: { inline_keyboard: botones } });
  }

  // --- ZONA DE ADMINISTRADORES ---
  if (isAdmin) {
    if (text === "👥 Gestionar Admins" && isPrincipal) {
      return bot.sendMessage(chatId, "⚙️ *Gestión de Administradores*\n¿Qué deseas hacer?", {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "➕ Agregar Admin", callback_data: "admin_add" }, { text: "➖ Quitar Admin", callback_data: "admin_remove" }],
            [{ text: "🎛️ Configurar Permisos", callback_data: "admin_perms" }]
          ]
        }
      });
    }

    if (text === "➕ Agregar Saldo") {
      if (!hasPermission('add_saldo')) return bot.sendMessage(chatId, "❌ No tienes permiso para esta función.");
      userStates[chatId] = { step: 'AWAITING_USER_ID' };
      return bot.sendMessage(chatId, "Envía el **ID del usuario** para recargarle saldo:", { parse_mode: "Markdown" });
    }

    if (text === "➖ Quitar Saldo") {
      if (!hasPermission('remove_saldo')) return bot.sendMessage(chatId, "❌ No tienes permiso para esta función.");
      const usersSnap = await get(ref(db, 'users'));
      if (!usersSnap.exists()) return bot.sendMessage(chatId, "No hay usuarios registrados.");

      let lista = "👥 *Usuarios con saldo disponible:*\n\n", hay = false;
      usersSnap.forEach((child) => {
        const user = child.val();
        if (user.saldo > 0) { lista += `👤 *${user.nombre}*\n🆔 ID: \`${child.key}\`\n💰 Saldo: $${user.saldo}\n\n`; hay = true; }
      });

      if (!hay) return bot.sendMessage(chatId, "❌ Nadie tiene saldo.");
      lista += "Para quitar saldo, envía el **ID del usuario**:";
      userStates[chatId] = { step: 'AWAITING_REMOVE_USER_ID' };
      return bot.sendMessage(chatId, lista, { parse_mode: "Markdown" });
    }
    
    if (text === "📦 Crear Producto") {
      if (!hasPermission('create_prod')) return bot.sendMessage(chatId, "❌ No tienes permiso para esta función.");
      userStates[chatId] = { step: 'AWAITING_PROD_NAME' };
      return bot.sendMessage(chatId, "Escribe el **Nombre del nuevo producto** (Ej: Free Fire Mod):", { parse_mode: "Markdown" });
    }
    
    if (text === "📋 Gestionar Productos") {
      if (!hasPermission('manage_prod')) return bot.sendMessage(chatId, "❌ No tienes permiso para esta función.");
      const prodsSnap = await get(ref(db, 'productos'));
      if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos.");
      
      const botones = [];
      prodsSnap.forEach((child) => botones.push([{ text: `Editar/Eliminar ${child.val().nombre}`, callback_data: `edit_prod:${child.key}` }]));
      return bot.sendMessage(chatId, "Selecciona un producto:", { reply_markup: { inline_keyboard: botones } });
    }

    if (text === "📊 Ver Stocks") {
      if (!hasPermission('view_stock')) return bot.sendMessage(chatId, "❌ No tienes permiso para esta función.");
      const prodsSnap = await get(ref(db, 'productos'));
      if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos.");

      let mensaje = "📊 *Inventario Actual:*\n\n";
      prodsSnap.forEach((child) => {
        const prod = child.val();
        mensaje += `📦 *${prod.nombre}*\n`;
        if (prod.opciones) {
          for (const optId in prod.opciones) {
            let stock = prod.opciones[optId].keys ? (Array.isArray(prod.opciones[optId].keys) ? prod.opciones[optId].keys.length : Object.keys(prod.opciones[optId].keys).length) : 0;
            mensaje += `  ├ ${prod.opciones[optId].titulo}: *${stock}* disponibles\n`;
          }
        } else { mensaje += `  └ Sin opciones.\n`; }
        mensaje += "\n";
      });
      return bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown" });
    }

    if (text === "✏️ Editar Precios") {
      if (!hasPermission('edit_price')) return bot.sendMessage(chatId, "❌ No tienes permiso para esta función.");
      const prodsSnap = await get(ref(db, 'productos'));
      if (!prodsSnap.exists()) return bot.sendMessage(chatId, "No hay productos.");

      const botones = [];
      prodsSnap.forEach((child) => botones.push([{ text: `✏️ Editar precios de ${child.val().nombre}`, callback_data: `edit_price_prod:${child.key}` }]));
      return bot.sendMessage(chatId, "Selecciona el producto:", { reply_markup: { inline_keyboard: botones } });
    }
  }

  // --- LÓGICA DE ESTADOS (STATE MACHINE) ---
  const state = userStates[chatId];
  if (!state) return;
  const currentState = { ...state };
  delete userStates[chatId];

  // (Mantenemos la lógica de estados tal cual, ya que las protecciones están en los botones iniciales)
  if (currentState.step === 'AWAITING_NEW_ADMIN_ID' && isPrincipal) {
    const newAdminId = text.trim();
    // Creamos al admin con todos los permisos apagados por defecto (seguridad)
    await set(ref(db, `sub_admins/${newAdminId}`), {
      agregado_por: chatId,
      permisos: { add_saldo: false, remove_saldo: false, create_prod: false, manage_prod: false, view_stock: false, edit_price: false }
    });
    bot.sendMessage(chatId, `✅ Sub-Admin \`${newAdminId}\` agregado exitosamente.\n\n⚠️ *Nota:* Por defecto tiene todas las funciones desactivadas. Usa "🎛️ Configurar Permisos" para activarle lo que necesites.`, { parse_mode: "Markdown" });
  }

  else if (currentState.step === 'AWAITING_USER_ID') {
    const targetUserId = text.trim();
    const userSnapshot = await get(ref(db, `users/${targetUserId}`));
    if (userSnapshot.exists()) {
      userStates[chatId] = { step: 'AWAITING_AMOUNT', targetUserId }; 
      bot.sendMessage(chatId, `Usuario: ${userSnapshot.val().nombre}. ¿Cuánto saldo agregas?`);
    } else bot.sendMessage(chatId, "❌ Usuario no encontrado.");
  } 
  
  else if (currentState.step === 'AWAITING_AMOUNT') {
    const amount = parseFloat(text.trim());
    if (isNaN(amount)) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "❌ Escribe un número válido."); }
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
      if (userData.saldo <= 0) return bot.sendMessage(chatId, "❌ Este usuario ya tiene $0 de saldo.");
      userStates[chatId] = { step: 'AWAITING_REMOVE_AMOUNT', targetUserId }; 
      bot.sendMessage(chatId, `Usuario: ${userData.nombre} (Saldo: $${userData.saldo}).\n¿Cuánto le deseas quitar?`);
    } else bot.sendMessage(chatId, "❌ Usuario no encontrado.");
  }

  else if (currentState.step === 'AWAITING_REMOVE_AMOUNT') {
    const amount = parseFloat(text.trim());
    if (isNaN(amount) || amount <= 0) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "❌ Número inválido."); }
    const targetRef = ref(db, `users/${currentState.targetUserId}/saldo`);
    const currentBalance = (await get(targetRef)).val() || 0;
    let nuevoSaldo = currentBalance - amount;
    if (nuevoSaldo < 0) nuevoSaldo = 0;
    await set(targetRef, nuevoSaldo);
    bot.sendMessage(chatId, `✅ Saldo descontado. Nuevo saldo: $${nuevoSaldo}`);
    bot.sendMessage(currentState.targetUserId, `⚠️ Se descontaron $${amount}. Saldo actual: $${nuevoSaldo}`);
  }

  else if (currentState.step === 'AWAITING_PROD_NAME') {
    const newProdRef = push(ref(db, 'productos'));
    await set(newProdRef, { nombre: text.trim() });
    bot.sendMessage(chatId, `✅ Producto "${text}" creado.`);
  }

  else if (currentState.step === 'AWAITING_OPT_NAME') {
    const match = text.match(/(.+?)\s+(\d+)\$$/); 
    if (!match) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "⚠️ Formato: '1 dia 3$'. Intenta de nuevo."); }
    const newOptRef = push(ref(db, `productos/${currentState.prodId}/opciones`));
    await set(newOptRef, { titulo: match[1].trim(), precio: parseInt(match[2]), keys: [] });
    bot.sendMessage(chatId, `✅ Opción agregada.\n¿Quieres agregarle keys ahora?`, {
      reply_markup: { inline_keyboard: [[{ text: "➕ Agregar Keys", callback_data: `add_keys:${currentState.prodId}:${newOptRef.key}` }]] }
    });
  }

  else if (currentState.step === 'AWAITING_KEYS') {
    const keysArray = text.split('\n').map(k => k.trim()).filter(k => k !== '');
    const keysRef = ref(db, `productos/${currentState.prodId}/opciones/${currentState.optId}/keys`);
    let currentKeys = (await get(keysRef)).val() || [];
    if (!Array.isArray(currentKeys)) currentKeys = Object.values(currentKeys);
    await set(keysRef, currentKeys.concat(keysArray));
    bot.sendMessage(chatId, `✅ Se agregaron ${keysArray.length} keys.`);
  }
  
  else if (currentState.step === 'AWAITING_NEW_PRICE') {
    const nuevoPrecio = parseInt(text.trim());
    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) { userStates[chatId] = currentState; return bot.sendMessage(chatId, "❌ Precio inválido."); }
    await update(ref(db), { [`productos/${currentState.prodId}/opciones/${currentState.optId}/precio`]: nuevoPrecio });
    bot.sendMessage(chatId, `✅ Precio actualizado a $${nuevoPrecio}.`);
  }
});

// --- 5. MANEJO DE BOTONES EN LÍNEA ---
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  const responder = () => bot.answerCallbackQuery(query.id).catch(()=>{});

  const { isAdmin, isPrincipal } = await checkAdminPermissions(chatId);

  // --- COMPRAS DE USUARIOS ---
  if (data.startsWith('buy_prod:')) {
    const prodId = data.split(':')[1];
    const producto = (await get(ref(db, `productos/${prodId}`))).val();
    if (!producto || !producto.opciones) { bot.sendMessage(chatId, "Producto sin duraciones."); return responder(); }

    const botones = [];
    for (const optId in producto.opciones) botones.push([{ text: `${producto.opciones[optId].titulo} - $${producto.opciones[optId].precio}`, callback_data: `checkout:${prodId}:${optId}` }]);
    bot.sendMessage(chatId, `🛒 *${producto.nombre}*\nElige la duración:`, { parse_mode: "Markdown", reply_markup: { inline_keyboard: botones } });
    return responder();
  }

  if (data.startsWith('checkout:')) {
    const [, prodId, optId] = data.split(':');
    const [userSnap, optSnap, prodNameSnap] = await Promise.all([ get(ref(db, `users/${chatId}`)), get(ref(db, `productos/${prodId}/opciones/${optId}`)), get(ref(db, `productos/${prodId}/nombre`)) ]);

    const user = userSnap.val() || { saldo: 0 };
    const opt = optSnap.val() || {};
    let keysDisp = opt.keys || [];
    if (!Array.isArray(keysDisp)) keysDisp = Object.values(keysDisp);

    if (keysDisp.length === 0) { bot.sendMessage(chatId, "❌ No hay keys disponibles."); return responder(); }
    if (user.saldo < opt.precio) { bot.sendMessage(chatId, `❌ *Saldo insuficiente.*\nTu saldo: $${user.saldo}\nPrecio: $${opt.precio}`, { parse_mode: "Markdown" }); return responder(); }

    const keyEntregada = keysDisp[0];
    const nuevoSaldo = user.saldo - opt.precio; 
    let keysUser = user.keys_compradas || [];
    if (!Array.isArray(keysUser)) keysUser = Object.values(keysUser);
    keysUser.push(keyEntregada);

    await update(ref(db), { [`users/${chatId}/saldo`]: nuevoSaldo, [`users/${chatId}/keys_compradas`]: keysUser, [`productos/${prodId}/opciones/${optId}/keys`]: keysDisp.slice(1) });
    bot.sendMessage(chatId, `✅ *¡COMPRA EXITOSA!*\n\nCompraste: *${opt.titulo}*\nKey: \`${keyEntregada}\`\n💰 Saldo: $${nuevoSaldo}`, { parse_mode: "Markdown" });
    
    if (keysDisp.slice(1).length === 0) {
      PRINCIPAL_ADMINS.forEach((adminId) => bot.sendMessage(adminId, `⚠️ *ALERTA DE INVENTARIO*\nSe agotaron las keys de ${prodNameSnap.val()} (${opt.titulo}).`, { parse_mode: "Markdown" }).catch(() => {}));
    }
    return responder();
  }

  // --- GESTIÓN DE SUB-ADMINS (SOLO PRINCIPALES) ---
  if (isPrincipal) {
    if (data === "admin_add") {
      userStates[chatId] = { step: 'AWAITING_NEW_ADMIN_ID' };
      bot.sendMessage(chatId, "Pídele al nuevo admin su ID de Telegram (lo puede ver en 'Mi Perfil') y envíalo aquí:");
    }
    
    if (data === "admin_remove") {
      const subAdmins = (await get(ref(db, 'sub_admins'))).val() || {};
      if (Object.keys(subAdmins).length === 0) return bot.sendMessage(chatId, "No hay sub-admins agregados.");
      const botones = Object.keys(subAdmins).map(id => ([{ text: `❌ Eliminar ID: ${id}`, callback_data: `del_admin:${id}` }]));
      bot.sendMessage(chatId, "Selecciona el Admin que deseas revocar:", { reply_markup: { inline_keyboard: botones } });
    }

    if (data.startsWith('del_admin:')) {
      const idToRemove = data.split(':')[1];
      await remove(ref(db, `sub_admins/${idToRemove}`));
      bot.editMessageText(`✅ Admin \`${idToRemove}\` revocado correctamente.`, { chat_id: chatId, message_id: query.message.message_id, parse_mode: "Markdown" });
    }

    if (data === "admin_perms") {
      const subAdmins = (await get(ref(db, 'sub_admins'))).val() || {};
      if (Object.keys(subAdmins).length === 0) return bot.sendMessage(chatId, "No hay sub-admins para configurar.");
      const botones = Object.keys(subAdmins).map(id => ([{ text: `⚙️ Configurar ID: ${id}`, callback_data: `edit_perms:${id}` }]));
      bot.sendMessage(chatId, "Selecciona el Admin para editar sus permisos:", { reply_markup: { inline_keyboard: botones } });
    }

    if (data.startsWith('edit_perms:')) {
      const adminId = data.split(':')[1];
      const permisos = (await get(ref(db, `sub_admins/${adminId}/permisos`))).val() || {};
      
      const btn = (name, key) => [{ text: `${permisos[key] ? '✅' : '❌'} ${name}`, callback_data: `tgl_p:${adminId}:${key}` }];
      
      bot.editMessageText(`🎛️ *Permisos para:* \`${adminId}\`\nToca un permiso para activarlo o desactivarlo.`, {
        chat_id: chatId, message_id: query.message.message_id, parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            btn('Agregar Saldo', 'add_saldo'), btn('Quitar Saldo', 'remove_saldo'),
            btn('Crear Prod.', 'create_prod'), btn('Gestionar Prod.', 'manage_prod'),
            btn('Ver Stocks', 'view_stock'), btn('Editar Precios', 'edit_price'),
            [{ text: "🔙 Volver a la lista", callback_data: "admin_perms" }]
          ]
        }
      });
    }

    if (data.startsWith('tgl_p:')) {
      const [, adminId, permKey] = data.split(':');
      const permRef = ref(db, `sub_admins/${adminId}/permisos/${permKey}`);
      const currentVal = (await get(permRef)).val() || false;
      await set(permRef, !currentVal);
      
      // Simular un click en edit_perms para recargar los botones
      query.data = `edit_perms:${adminId}`;
      bot.emit('callback_query', query); 
      return; 
    }
  }

  // --- FUNCIONES REGULARES DE GESTIÓN (PARA CUALQUIER ADMIN AUTORIZADO) ---
  if (isAdmin) {
    if (data.startsWith('edit_prod:')) {
      const prodId = data.split(':')[1];
      const prodSnap = await get(ref(db, `productos/${prodId}/nombre`));
      bot.sendMessage(chatId, `⚙️ *Opciones para: ${prodSnap.exists() ? prodSnap.val() : "este producto"}*`, {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: [
            [{ text: "➕ Agregar Duración/Precio", callback_data: `add_opt:${prodId}` }],
            [{ text: "🔑 Agregar Keys a Duración", callback_data: `choose_opt_keys:${prodId}` }],
            [{ text: "🗑️ Eliminar Producto", callback_data: `del_prod:${prodId}` }]
          ] }
      });
    }

    if (data.startsWith('choose_opt_keys:')) {
      const prodId = data.split(':')[1];
      const opciones = (await get(ref(db, `productos/${prodId}/opciones`))).val();
      if (!opciones) { bot.sendMessage(chatId, "⚠️ No tiene duraciones creadas aún."); return responder(); }
      
      const botones = [];
      for (const optId in opciones) botones.push([{ text: `🔑 ${opciones[optId].titulo} - $${opciones[optId].precio}`, callback_data: `add_keys:${prodId}:${optId}` }]);
      bot.sendMessage(chatId, "Selecciona la duración:", { reply_markup: { inline_keyboard: botones } });
    }
    
    if (data.startsWith('edit_price_prod:')) {
      const prodId = data.split(':')[1];
      const opciones = (await get(ref(db, `productos/${prodId}/opciones`))).val();
      if (!opciones) { bot.sendMessage(chatId, "⚠️ No tiene duraciones."); return responder(); }

      const botones = [];
      for (const optId in opciones) botones.push([{ text: `${opciones[optId].titulo} (Actual: $${opciones[optId].precio})`, callback_data: `edit_price_opt:${prodId}:${optId}` }]);
      bot.sendMessage(chatId, "Selecciona la duración:", { reply_markup: { inline_keyboard: botones } });
    }

    if (data.startsWith('edit_price_opt:')) {
      const [, prodId, optId] = data.split(':');
      userStates[chatId] = { step: 'AWAITING_NEW_PRICE', prodId, optId };
      bot.sendMessage(chatId, "Escribe el **nuevo precio** (solo número):", { parse_mode: "Markdown" });
    }

    if (data.startsWith('del_prod:')) {
      await remove(ref(db, `productos/${data.split(':')[1]}`));
      bot.sendMessage(chatId, "🗑️ ✅ Producto eliminado.");
    }

    if (data.startsWith('add_opt:')) {
      userStates[chatId] = { step: 'AWAITING_OPT_NAME', prodId: data.split(':')[1] };
      bot.sendMessage(chatId, "Escribe el **título y precio** terminando con $ (Ej: `1 dia 3$`)", { parse_mode: "Markdown" });
    }

    if (data.startsWith('add_keys:')) {
      const [, prodId, optId] = data.split(':');
      userStates[chatId] = { step: 'AWAITING_KEYS', prodId, optId };
      bot.sendMessage(chatId, "Envía las **Keys** una debajo de otra:", { parse_mode: "Markdown" });
    }
  }

  responder();
});

console.log("Bot de TEMO STORE iniciado (Gestor de Admins integrado)...");
