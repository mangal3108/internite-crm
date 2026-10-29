package com.nexacrm.config;

import com.nexacrm.model.User;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.data.convert.ReadingConverter;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;

import java.util.List;

@Configuration
public class MongoConversionConfig {

    @Bean
    public MongoCustomConversions mongoCustomConversions() {
        return new MongoCustomConversions(List.of(new LegacyRoleReadingConverter()));
    }

    /** Maps role values that no longer exist in {@link User.Role} so old user documents still load. */
    @ReadingConverter
    static class LegacyRoleReadingConverter implements Converter<String, User.Role> {
        @Override
        public User.Role convert(String source) {
            if ("SUPER_ADMIN".equals(source)) {
                return User.Role.ADMIN;
            }
            return User.Role.valueOf(source);
        }
    }
}
