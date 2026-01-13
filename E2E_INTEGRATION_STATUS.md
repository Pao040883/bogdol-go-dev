# E2E-Verschlüsselung - Integrationsstatus

## ✅ FERTIG IMPLEMENTIERT

### Backend (Django)
- ✅ **UserProfile.public_key** - Speichert RSA Public Key (base64)
- ✅ **UserProfile.public_key_updated_at** - Timestamp
- ✅ **ChatMessage.is_encrypted** - Flag für verschlüsselte Nachrichten
- ✅ **Migration erstellt und angewendet** (0010_chatmessage_is_encrypted_userprofile_public_key_and_more)
- ✅ **API-Endpoint: POST /api/profiles/upload_public_key/** - Upload eigenen Public Key
- ✅ **API-Endpoint: GET /api/profiles/get_public_keys/?user_ids=1,2,3** - Public Keys abrufen
- ✅ **Serializer erweitert** - public_key, is_encrypted in Responses

### Frontend (Angular/Ionic)
- ✅ **CryptoService** (frontend/src/app/core/services/crypto.service.ts)
  - RSA-OAEP 2048-bit Key-Generierung
  - AES-GCM 256-bit Content-Verschlüsselung
  - Hybrid-Encryption (RSA für Key, AES für Content)
  - Key Storage in localStorage
  - Import/Export von Keys (base64)
  
- ✅ **IntranetApiService erweitert**
  - `uploadPublicKey(publicKey: string)` - Public Key hochladen
  - `getPublicKeys(userIds: number[])` - Public Keys abrufen
  
- ✅ **TypeScript Models erweitert**
  - UserProfile: `public_key`, `public_key_updated_at`
  - ChatMessage: `is_encrypted`
  
- ✅ **AuthService erweitert**
  - `initializeE2EKeys()` - Automatische Key-Generierung beim Login
  - Lädt bestehende Keys aus localStorage
  - Generiert neue Keys bei First-Login
  - Uploaded Public Key automatisch zum Server

## 🚧 NOCH ZU TUN

### Frontend - Chat Component Integration

#### 1. Message Encryption beim Senden (chat.component.ts)
```typescript
async sendMessage() {
  if (!this.newMessageContent.trim()) return;

  const currentUserId = this.currentUser?.id;
  if (!currentUserId) return;

  try {
    // 1. Hole Public Keys der Empfänger
    const recipientIds = this.conversation.participants
      .filter(id => id !== currentUserId);
    
    const publicKeys = await this.apiService
      .getPublicKeys(recipientIds)
      .toPromise();
    
    // 2. Verschlüssele für jeden Empfänger
    let encryptedContent = this.newMessageContent;
    let isEncrypted = false;
    
    if (publicKeys && Object.keys(publicKeys).length > 0) {
      // Nimm ersten Empfänger (für 1:1 Chat)
      const firstRecipient = Object.values(publicKeys)[0];
      if (firstRecipient.public_key) {
        const recipientPublicKey = await this.cryptoService
          .importPublicKey(firstRecipient.public_key);
        
        encryptedContent = await this.cryptoService
          .encryptMessage(this.newMessageContent, recipientPublicKey);
        
        isEncrypted = true;
        console.log('🔐 Message encrypted for recipient');
      }
    }

    // 3. Sende verschlüsselte Nachricht
    const tempMessage: ChatMessage = {
      id: Date.now(),
      conversation: this.conversationId,
      sender: currentUserId,
      sender_data: {
        id: currentUserId,
        username: this.currentUser.username,
        full_name: `${this.currentUser.first_name} ${this.currentUser.last_name}`,
        online_status: 'online'
      },
      message_type: 'text',
      content: encryptedContent,  // Verschlüsselter Content
      is_encrypted: isEncrypted,
      reactions: {},
      read_by: [currentUserId],
      read_by_count: 1,
      is_edited: false,
      is_deleted: false,
      sent_at: new Date().toISOString()
    };

    // Optimistic UI
    this.messages.push(tempMessage);
    this.newMessageContent = '';

    // WebSocket Send
    this.websocketService.sendMessage(
      this.conversationId,
      encryptedContent,
      isEncrypted
    );
    
  } catch (error) {
    console.error('Encryption failed:', error);
    // Fallback: Sende unverschlüsselt
    this.sendUnencryptedMessage();
  }
}
```

#### 2. Message Decryption beim Empfang (chat.component.ts)
```typescript
private async handleIncomingMessage(message: ChatMessage) {
  // Wenn Nachricht verschlüsselt ist, entschlüsseln
  if (message.is_encrypted && message.content) {
    const currentUserId = this.currentUser?.id;
    if (!currentUserId) return;

    try {
      // Lade eigenes Key-Pair
      const keyPair = await this.cryptoService.retrieveKeyPair(currentUserId);
      
      if (keyPair) {
        // Entschlüssele Nachricht
        const decryptedContent = await this.cryptoService
          .decryptMessage(message.content, keyPair.privateKey);
        
        message.content = decryptedContent;
        console.log('🔓 Message decrypted successfully');
      } else {
        console.warn('⚠️ No private key available for decryption');
        message.content = '[Verschlüsselte Nachricht - Schlüssel nicht verfügbar]';
      }
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      message.content = '[Entschlüsselung fehlgeschlagen]';
    }
  }

  // Füge Nachricht zur Liste hinzu
  this.messages.push(message);
}
```

#### 3. WebSocket Service erweitern (intranet-websocket.service.ts)
```typescript
sendMessage(conversationId: number, content: string, isEncrypted: boolean = false) {
  if (this.socket && this.socket.readyState === WebSocket.OPEN) {
    this.socket.send(JSON.stringify({
      type: 'message',
      conversation_id: conversationId,
      content: content,
      is_encrypted: isEncrypted,
      message_type: 'text'
    }));
  }
}
```

#### 4. UI-Indicator für Verschlüsselung (chat.component.html)
```html
<!-- Lock Icon für verschlüsselte Nachrichten -->
<div class="message-header">
  <span class="sender-name">{{ message.sender_data.full_name }}</span>
  <ion-icon 
    *ngIf="message.is_encrypted" 
    name="lock-closed" 
    class="encryption-icon"
    title="End-to-End verschlüsselt">
  </ion-icon>
  <span class="timestamp">{{ message.sent_at | date:'HH:mm' }}</span>
</div>
```

```scss
.encryption-icon {
  font-size: 0.75rem;
  color: var(--ion-color-success);
  margin-left: 0.25rem;
}
```

#### 5. Chat Header - Encryption Status
```html
<ion-header>
  <ion-toolbar>
    <ion-title>
      {{ conversation?.name || getOtherParticipant()?.full_name }}
      <span *ngIf="isE2EEnabled" class="e2e-badge">
        <ion-icon name="lock-closed"></ion-icon> E2E
      </span>
    </ion-title>
  </ion-toolbar>
</ion-header>
```

```typescript
get isE2EEnabled(): boolean {
  // Prüfe ob alle Teilnehmer Public Keys haben
  return this.conversation?.participants_data?.every(p => p.public_key) || false;
}
```

### Gruppenchat-Verschlüsselung (Fortgeschritten)

Für Gruppenchats muss die Nachricht für **jeden** Teilnehmer einzeln verschlüsselt werden:

```typescript
// Für jeden Empfänger verschlüsseln
const encryptedMessages = await Promise.all(
  recipientIds.map(async (recipientId) => {
    const recipientKey = publicKeys[recipientId]?.public_key;
    if (recipientKey) {
      const importedKey = await this.cryptoService.importPublicKey(recipientKey);
      const encrypted = await this.cryptoService.encryptMessage(content, importedKey);
      return { recipientId, encrypted };
    }
    return null;
  })
);

// Sende an Backend mit Recipient-Mapping
this.apiService.sendGroupMessage(conversationId, encryptedMessages);
```

## 📋 Testing-Checkliste

- [ ] Login generiert automatisch Keys
- [ ] Public Key wird zum Server hochgeladen
- [ ] Public Keys können abgerufen werden
- [ ] Nachrichten werden verschlüsselt gesendet
- [ ] Nachrichten werden entschlüsselt empfangen
- [ ] Lock-Icon wird bei verschlüsselten Nachrichten angezeigt
- [ ] Unverschlüsselte Nachrichten funktionieren weiterhin
- [ ] Fehlende Keys führen zu Fallback (unverschlüsselt)
- [ ] Decryption-Fehler zeigen sinnvolle Fehlermeldung

## 🔒 Sicherheitshinweise

1. **Private Keys bleiben lokal** - Nie zum Server senden!
2. **localStorage für MVP** - Für Produktion IndexedDB erwägen
3. **Key-Backup** - User sollte Keys exportieren können
4. **Key-Recovery** - Bei Verlust sind alte Nachrichten unlesbar
5. **Multi-Device** - Aktuell nur ein Gerät, später Sync implementieren

## 🚀 Nächste Schritte

1. Chat-Component Encryption-Logic implementieren
2. WebSocket-Service erweitern
3. UI-Indicators hinzufügen
4. Ausführliches Testing
5. Später: Gruppenchat-Support
6. Später: Key-Backup/Recovery UI
7. Später: Multi-Device Key-Sync
