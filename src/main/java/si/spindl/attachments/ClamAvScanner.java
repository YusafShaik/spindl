package si.spindl.attachments;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.io.DataOutputStream;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

@Component
public class ClamAvScanner {
    @Value("${spindl.attachments.clamav-host:}") private String host;
    @Value("${spindl.attachments.clamav-port:3310}") private int port;
    @Value("${spindl.attachments.clamav-timeout-millis:5000}") private int timeoutMillis;

    public void scan(InputStream input) {
        if (host == null || host.isBlank()) throw unavailable();
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress(host, port), timeoutMillis);
            socket.setSoTimeout(timeoutMillis);
            DataOutputStream output = new DataOutputStream(socket.getOutputStream());
            output.write("zINSTREAM".getBytes(StandardCharsets.US_ASCII)); output.writeByte(0);
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) { output.writeInt(read); output.write(buffer, 0, read); }
            output.writeInt(0); output.flush();
            var response = new java.io.ByteArrayOutputStream(); int value;
            while ((value=socket.getInputStream().read())!=-1 && value!=0) { if(response.size()>=2048)throw unavailable(); response.write(value); }
            String result = response.toString(StandardCharsets.US_ASCII).trim();
            if (result.endsWith(" OK")) return;
            if (result.contains(" FOUND")) throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "The uploaded file was blocked by malware scanning");
            throw unavailable();
        } catch (ResponseStatusException e) { throw e; }
        catch (Exception e) { throw unavailable(); }
    }

    private ResponseStatusException unavailable() { return new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "File scanning is unavailable. Contact your workspace administrator."); }
}
