<?php

final class SimpleContent {
    private $_contentFilename;

    public function __construct($contentFilename) {
        $this->_contentFilename = $contentFilename;
    }

    public function render($page) {
        require 'template/' . $this->_contentFilename;
    }
}
