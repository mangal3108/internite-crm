package com.nexacrm.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeadPipelineBoardDTO implements Serializable {
    private static final long serialVersionUID = 1L;

    private List<LeadDTO> content;
    private Map<String, List<LeadActivityDTO>> activities;
    private int page;
    private int size;
    private long total;
    private int totalPages;
    private boolean first;
    private boolean last;
}
