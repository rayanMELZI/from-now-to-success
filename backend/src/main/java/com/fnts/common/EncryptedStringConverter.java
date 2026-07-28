package com.fnts.common;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Transparently encrypts a String column on write and decrypts on read, so the
 * rest of the app keeps working with plaintext. Apply with
 * {@code @Convert(converter = EncryptedStringConverter.class)} on the fields
 * that hold sensitive free-text. Hibernate resolves this as a Spring bean, so
 * the {@link EncryptionService} is injected.
 */
@Converter
public class EncryptedStringConverter implements AttributeConverter<String, String> {

    private final EncryptionService encryption;

    public EncryptedStringConverter(EncryptionService encryption) {
        this.encryption = encryption;
    }

    @Override
    public String convertToDatabaseColumn(String attribute) {
        return encryption.encrypt(attribute);
    }

    @Override
    public String convertToEntityAttribute(String dbData) {
        return encryption.decrypt(dbData);
    }
}
