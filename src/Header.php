<?php

final class Header {
    private $_customScripts = array();

    public function render() {
        require 'template/header.phtml';
    }

    public function addScript($filename) {
        $this->_customScripts[] = $filename;
    }
}
