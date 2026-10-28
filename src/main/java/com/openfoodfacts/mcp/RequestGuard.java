package com.openfoodfacts.mcp;
import jakarta.servlet.*;import jakarta.servlet.http.*;import org.slf4j.*;import org.springframework.beans.factory.annotation.Value;import org.springframework.stereotype.Component;import org.springframework.web.filter.OncePerRequestFilter;import java.io.*;import java.nio.charset.StandardCharsets;import java.util.*;
@Component public class RequestGuard extends OncePerRequestFilter {
 private static final Logger log=LoggerFactory.getLogger(RequestGuard.class);
 @Value("${mcp.endpoint-path:/mcp}") String endpoint; @Value("${mcp.allowed-origins:}") String origins; @Value("${mcp.max-request-body-bytes:1048576}") int maxBytes;
 @Override protected boolean shouldNotFilter(HttpServletRequest r){return !r.getRequestURI().equals(endpoint);}
 @Override protected void doFilterInternal(HttpServletRequest r,HttpServletResponse s,FilterChain chain)throws IOException,ServletException{
   String correlation=r.getHeader("X-Correlation-ID");if(correlation==null||correlation.isBlank())correlation=UUID.randomUUID().toString();s.setHeader("X-Correlation-ID",correlation);org.slf4j.MDC.put("correlationId",correlation);long started=System.nanoTime();
   try{guarded(r,s,chain);}finally{log.info("HTTP request correlationId={} method={} path={} status={} durationMs={}",correlation,r.getMethod(),r.getRequestURI(),s.getStatus(),(System.nanoTime()-started)/1_000_000);org.slf4j.MDC.remove("correlationId");}
 }
 private void guarded(HttpServletRequest r,HttpServletResponse s,FilterChain chain)throws IOException,ServletException{
   String origin=r.getHeader("Origin");List<String> allowed=Arrays.stream(origins.split(",")).map(String::trim).filter(x->!x.isEmpty()).toList();
   if(origin!=null&&!allowed.isEmpty()&&!allowed.contains(origin)){s.setStatus(403);s.setContentType("application/json");s.getWriter().write("{\"error\":\"Origin not allowed\"}");return;}
   if("GET".equals(r.getMethod())&&r.getHeader("Mcp-Session-Id")==null){s.setStatus(405);s.setContentType("application/json");s.getWriter().write("{\"error\":\"Method Not Allowed. Use POST for MCP requests.\"}");return;}
   if(r.getContentLengthLong()>maxBytes){s.setStatus(413);s.setContentType("application/json");s.getWriter().write("{\"error\":\"Request body too large\"}");return;}
   if("POST".equals(r.getMethod())){byte[] body=r.getInputStream().readNBytes(maxBytes+1);if(body.length>maxBytes){s.setStatus(413);s.setContentType("application/json");s.getWriter().write("{\"error\":\"Request body too large\"}");return;}chain.doFilter(new CachedBodyRequest(r,body),s);}else chain.doFilter(r,s);
 }
 static class CachedBodyRequest extends HttpServletRequestWrapper {private final byte[] body;CachedBodyRequest(HttpServletRequest r,byte[] b){super(r);body=b;}public ServletInputStream getInputStream(){var stream=new ByteArrayInputStream(body);return new ServletInputStream(){public int read(){return stream.read();}public boolean isFinished(){return stream.available()==0;}public boolean isReady(){return true;}public void setReadListener(ReadListener l){}};}public BufferedReader getReader(){return new BufferedReader(new InputStreamReader(getInputStream(),StandardCharsets.UTF_8));}}
}
