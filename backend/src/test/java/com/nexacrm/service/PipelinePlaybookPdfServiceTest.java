package com.nexacrm.service;

import com.nexacrm.model.Lead;
import com.nexacrm.repository.LeadRepository;
import com.nexacrm.security.TenantContext;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PipelinePlaybookPdfServiceTest {

    @Mock private LeadRepository leadRepository;
    @Mock private LeadActivityService leadActivityService;

    @Test
    void generatesReadablePlaybookPdfFromTenantPipeline() throws Exception {
        TenantContext.setCurrentTenantId(1L);
        Lead lead = Lead.builder()
            .name("आदित्य Raj")
            .company("Internite Corporation")
            .email("info@example.com")
            .phone("+919876543210")
            .source(Lead.LeadSource.META_ADS)
            .score(Lead.LeadScore.HOT)
            .status(Lead.LeadStatus.NEW)
            .build();
        lead.setId("lead-1");
        lead.setCreatedAt(LocalDateTime.of(2026, 9, 16, 10, 30));

        when(leadRepository.findByTenantIdAndDeletedFalse(1L)).thenReturn(List.of(lead));
        when(leadActivityService.listVisibleLeadIds(anyList())).thenReturn(Map.of("lead-1", List.of()));

        byte[] pdf;
        try {
            pdf = new PipelinePlaybookPdfService(leadRepository, leadActivityService).generate();
        } finally {
            TenantContext.clear();
        }

        assertTrue(pdf.length > 1_000);
        try (PDDocument document = PDDocument.load(pdf)) {
            assertTrue(document.getNumberOfPages() >= 1);
            String text = new PDFTextStripper().getText(document);
            assertFalse(text.isBlank());
            assertTrue(text.contains("Internite CRM Pipeline Playbook"));
            assertTrue(text.contains("Raj"));
        }
    }
}
