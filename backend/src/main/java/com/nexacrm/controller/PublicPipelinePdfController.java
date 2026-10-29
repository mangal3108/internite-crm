package com.nexacrm.controller;

import com.nexacrm.service.PipelinePdfMediaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;

@RestController
@RequestMapping("/api/public/pipeline-pdf")
@RequiredArgsConstructor
public class PublicPipelinePdfController {

    private final PipelinePdfMediaService mediaService;

    @GetMapping("/{token}")
    public ResponseEntity<byte[]> get(@PathVariable String token) {
        return mediaService.get(token)
            .map(pdf -> ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                    .filename(pdf.fileName(), StandardCharsets.UTF_8)
                    .build()
                    .toString())
                .contentLength(pdf.content().length)
                .body(pdf.content()))
            .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
