<?php

final class SimpleContent {
    private $_contentFilename;
    private $_linked;

    public function __construct($contentFilename, array $linked = array()) {
        $this->_contentFilename = $contentFilename;
        $this->_linked = $linked;
    }

    public function render($page) {
        require 'template/' . $this->_contentFilename;
    }

    private function _link($key, $altText = '') {
        if (isset($this->_linked[$key])) {
            if ($altText) {
                return $this->_linked[$key]->href()->withText($altText);
            }
            return $this->_linked[$key]->href();
        }
        return $altText;
    }
}
