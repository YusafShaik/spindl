package si.spindl;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;
import si.spindl.config.SpindlProperties;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(SpindlProperties.class)
public class SpindlApplication {

	public static void main(String[] args) {
		SpringApplication.run(SpindlApplication.class, args);
	}

}
