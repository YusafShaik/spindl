package si.spindl.attachments;

import si.spindl.common.exception.ServiceUnavailableException;
import si.spindl.common.exception.UnprocessableEntityException;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;
import si.spindl.config.SpindlProperties;

import java.io.DataOutputStream;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

@Component
public class ClamAvScanner implements MalwareScanner {
    private final boolean enabled;
    private final String host;
    private final int port;
    private final int timeoutMillis;

    public ClamAvScanner(SpindlProperties properties) {
        SpindlProperties.Attachments attachments = properties.getAttachments();
        this.enabled = attachments.isClamavEnabled();
        this.host = attachments.getClamavHost();
        this.port = attachments.getClamavPort();
        this.timeoutMillis = attachments.getClamavTimeoutMillis();
    }

    public void scan(InputStream input) {
        if (!enabled || host == null || host.isBlank()) return;
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
            if (result.contains(" FOUND")) throw new UnprocessableEntityException("The uploaded file was blocked by malware scanning");
            throw unavailable();
        } catch (ResponseStatusException e) { throw e; }
        catch (Exception e) { throw unavailable(); }
    }

    private ResponseStatusException unavailable() { return new ServiceUnavailableException("File scanning is unavailable. Contact your workspace administrator."); }
}
