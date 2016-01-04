<?php

final class SoftwareHomeContent {

    public function __construct($summaries) {
        $this->_summaries = $summaries;
    }

    public function render($page) {
        require 'template/content-software.phtml';
    }
}
