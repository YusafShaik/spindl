package si.spindl.common.presentation;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;

class DisplayMarkTest {

    @Test
    void usesTheFirstLetterOfTheFirstTwoWords() {
        assertEquals("NI", DisplayMark.fromName("Northstar Industries"));
    }

    @Test
    void usesTwoLettersWhenThereIsOneWord() {
        assertEquals("BO", DisplayMark.fromName("Bolt"));
    }

    @Test
    void fallsBackWhenTheNameHasNoLetters() {
        assertEquals("?", DisplayMark.fromName("***"));
    }

    @Test
    void formatsRupeesWithoutTrailingZeros() {
        assertEquals("₹ 100", MoneyFormat.inr(new BigDecimal("100.00")));
        assertEquals("₹ 100.5", MoneyFormat.inr(new BigDecimal("100.50")));
    }

    @Test
    void formatsTheRequestedCurrencyAndDefaultsBlankCodesToInr() {
        assertEquals("$ 100", MoneyFormat.format(new BigDecimal("100.00"), "USD"));
        assertEquals("€ 100", MoneyFormat.format(new BigDecimal("100.00"), "eur"));
        assertEquals("₹ 100", MoneyFormat.format(new BigDecimal("100.00"), " "));
        assertEquals("ZZZ 100", MoneyFormat.format(new BigDecimal("100.00"), "ZZZ"));
    }
}
