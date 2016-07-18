<?php

final class OronjoBuy {
    private $_text;
    private $_itemId;

    public function __construct($text, $itemId) {
        $this->_text = $text;
        $this->_itemId = $itemId;
    }

    public final function __toString() {
        return '<a class="btn btn-default" href="http://www.oronjo.com/live/next/?fi=' . $this->_itemId . '" target="_blank">'
            . '<img src="https://www.oronjo.com/live/images/image.php?id=' . $this->_itemId . '" border="0" alt="">'
            . '<br>' . $this->_text
            . '</a>';
    }

}
