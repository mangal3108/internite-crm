package com.nexacrm.controller;

import com.nexacrm.service.DailyLeadReportService;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.*;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DailyLeadReportSecurityTest {
    @Configuration @EnableMethodSecurity
    static class Config {
        @Bean DailyLeadReportService reports() { return mock(DailyLeadReportService.class); }
        @Bean DailyLeadReportController controller(DailyLeadReportService reports) { return new DailyLeadReportController(reports); }
    }
    @Test void reportReadDoesNotGrantExport() {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            var controller = context.getBean(DailyLeadReportController.class);
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("reader", "", List.of(new SimpleGrantedAuthority("tasks.read"))));
            assertDoesNotThrow(controller::yesterday);
            assertThrows(AccessDeniedException.class, controller::export);
            SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken("admin", "", List.of(new SimpleGrantedAuthority("tasks.read"), new SimpleGrantedAuthority("reports.export"))));
            assertDoesNotThrow(controller::export);
        } finally { SecurityContextHolder.clearContext(); }
    }
}
