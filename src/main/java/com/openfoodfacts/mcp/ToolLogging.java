package com.openfoodfacts.mcp;
import io.modelcontextprotocol.spec.McpSchema.CallToolResult;
import org.aspectj.lang.ProceedingJoinPoint;import org.aspectj.lang.annotation.*;import org.slf4j.*;import org.springframework.stereotype.Component;import java.util.UUID;
@Aspect @Component public class ToolLogging {
 private static final Logger log=LoggerFactory.getLogger(ToolLogging.class);
 @Around("@annotation(org.springframework.ai.mcp.annotation.McpTool)")
 public Object logTool(ProceedingJoinPoint point)throws Throwable{String tool=point.getSignature().getName(),id=org.slf4j.MDC.get("correlationId");if(id==null)id="tool-"+UUID.randomUUID();long start=System.nanoTime();log.info("Tool call started correlationId={} method=tools/call toolName={}",id,tool);try{Object r=point.proceed();boolean error=r instanceof CallToolResult c&&Boolean.TRUE.equals(c.isError());log.info("Tool call completed correlationId={} method=tools/call toolName={} durationMs={} isError={}",id,tool,(System.nanoTime()-start)/1_000_000,error);return r;}catch(Throwable t){log.error("Tool call failed correlationId={} method=tools/call toolName={} durationMs={} error={}",id,tool,(System.nanoTime()-start)/1_000_000,t.getClass().getSimpleName());throw t;}}
}
