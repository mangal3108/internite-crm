package com.nexacrm.model;

import lombok.*;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;

import java.util.ArrayList;
import java.util.List;

@Document(collection = "workflows")
@CompoundIndexes({
    @CompoundIndex(name = "workflow_tenant_status_idx", def = "{'tenant_id': 1, 'deleted': 1, 'status': 1, 'createdAt': -1}"),
    @CompoundIndex(name = "workflow_tenant_category_idx", def = "{'tenant_id': 1, 'deleted': 1, 'category': 1}")
})
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Workflow extends BaseEntity {

    @Field("name")
    private String name;

    @Field("category")
    private String category;

    @Field("status")
    private WorkflowStatus status = WorkflowStatus.ACTIVE;

    @Field("runs")
    private Integer runs = 0;

    @Field("last_run")
    private String lastRun = "Never";

    @Field("priority")
    private String priority;

    @Field("steps")
    @Builder.Default
    private List<WorkflowStep> steps = new ArrayList<>();

    public enum WorkflowStatus { ACTIVE, PAUSED }

    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    public static class WorkflowStep {
        @Field("type")
        private String type;

        @Field("text")
        private String text;
    }
}
