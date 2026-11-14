package si.spindl;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SpindlApplication {

	public static void main(String[] args) {
		SpringApplication.run(SpindlApplication.class, args);
	}

}
