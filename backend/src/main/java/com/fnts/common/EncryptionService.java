package com.fnts.common;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.stereotype.Service;

import com.fnts.config.AppProperties;

/**
 * Authenticated encryption (AES-256-GCM) for sensitive free-text stored at rest.
 *
 * Stored form: "fnts1:" + Base64( IV(12) ‖ ciphertext ‖ GCM tag(16) ). The
 * version prefix lets reads tell encrypted values from legacy plaintext (so the
 * rollout is transparent) and leaves room for future key rotation ("fnts2:").
 * A fresh random IV per value means the same plaintext never produces the same
 * ciphertext, so two users with the same habit name can't be correlated.
 *
 * The key lives in a server secret (DATA_ENCRYPTION_KEY), never in the database —
 * a leaked DB dump is therefore useless without it.
 */
@Service
public class EncryptionService {

    static final String PREFIX = "fnts1:";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int IV_LENGTH = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public EncryptionService(AppProperties props) {
        String configured = props.crypto() == null ? null : props.crypto().key();
        if (configured == null || configured.isBlank()) {
            throw new IllegalStateException(
                    "DATA_ENCRYPTION_KEY is not set. Generate one with: openssl rand -base64 32");
        }
        byte[] raw = Base64.getDecoder().decode(configured);
        if (raw.length != 32) {
            throw new IllegalStateException(
                    "DATA_ENCRYPTION_KEY must decode to 32 bytes (AES-256); got " + raw.length);
        }
        this.key = new SecretKeySpec(raw, "AES");
    }

    public boolean isEncrypted(String value) {
        return value != null && value.startsWith(PREFIX);
    }

    /** Returns the "fnts1:"-prefixed ciphertext, or the input unchanged if null. */
    public String encrypt(String plaintext) {
        if (plaintext == null) {
            return null;
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            random.nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));

            byte[] combined = new byte[iv.length + ciphertext.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(ciphertext, 0, combined, iv.length, ciphertext.length);
            return PREFIX + Base64.getEncoder().encodeToString(combined);
        } catch (Exception e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    /** Reverses {@link #encrypt}; legacy plaintext (no prefix) is returned as-is. */
    public String decrypt(String stored) {
        if (stored == null) {
            return null;
        }
        if (!isEncrypted(stored)) {
            return stored; // legacy plaintext written before encryption was enabled
        }
        try {
            byte[] combined = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            GCMParameterSpec spec = new GCMParameterSpec(TAG_BITS, combined, 0, IV_LENGTH);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, spec);
            byte[] plaintext = cipher.doFinal(
                    combined, IV_LENGTH, combined.length - IV_LENGTH);
            return new String(plaintext, StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Decryption failed", e);
        }
    }
}
