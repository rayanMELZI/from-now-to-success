package com.fnts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Base64;

import org.junit.jupiter.api.Test;

import com.fnts.common.EncryptionService;
import com.fnts.config.AppProperties;

class EncryptionServiceTest {

    private static EncryptionService service(String base64Key) {
        AppProperties props = new AppProperties(
                null, null, null, null, null,
                new AppProperties.Crypto(base64Key), null, false);
        return new EncryptionService(props);
    }

    private static EncryptionService service() {
        // deterministic 32-byte test key
        byte[] key = new byte[32];
        for (int i = 0; i < key.length; i++) key[i] = (byte) i;
        return service(Base64.getEncoder().encodeToString(key));
    }

    @Test
    void roundTripsPlaintext() {
        EncryptionService s = service();
        String encrypted = s.encrypt("quit smoking");
        assertTrue(encrypted.startsWith("fnts1:"));
        assertEquals("quit smoking", s.decrypt(encrypted));
    }

    @Test
    void sameInputProducesDifferentCiphertext() {
        EncryptionService s = service();
        // random IV per call → no correlation between identical plaintexts
        assertFalse(s.encrypt("5 prayers").equals(s.encrypt("5 prayers")));
    }

    @Test
    void nullsPassThrough() {
        EncryptionService s = service();
        assertNull(s.encrypt(null));
        assertNull(s.decrypt(null));
    }

    @Test
    void legacyPlaintextIsReturnedAsIs() {
        // a value written before encryption existed has no prefix
        assertEquals("old plaintext", service().decrypt("old plaintext"));
    }

    @Test
    void unicodeSurvives() {
        EncryptionService s = service();
        String text = "صلاة · méditer 🧘 10×";
        assertEquals(text, s.decrypt(s.encrypt(text)));
    }

    @Test
    void tamperedCiphertextIsRejected() {
        EncryptionService s = service();
        String encrypted = s.encrypt("sensitive");
        String tampered = encrypted.substring(0, encrypted.length() - 2)
                + (encrypted.endsWith("A") ? "B" : "A");
        assertThrows(IllegalStateException.class, () -> s.decrypt(tampered));
    }

    @Test
    void refusesToStartWithoutAKey() {
        assertThrows(IllegalStateException.class, () -> service(""));
    }

    @Test
    void refusesAKeyOfWrongLength() {
        // 16 bytes, not 32 → not AES-256
        String shortKey = Base64.getEncoder().encodeToString(new byte[16]);
        assertThrows(IllegalStateException.class, () -> service(shortKey));
    }
}
